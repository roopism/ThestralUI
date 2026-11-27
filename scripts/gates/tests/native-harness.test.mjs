import assert from 'node:assert/strict';
import { copyFileSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Script } from 'node:vm';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import fixtures from '../../../catalog/native/scenarios/fixtures.cjs';
import { runNativeScenarios } from '../../../tests/simulator/scenarios.mjs';

test('the pending Button has a separate device journey with two physical presses 80 ms apart', () => {
  const resets = [];
  const flows = [];
  const root = resolve(import.meta.dirname, '../../..');
  const registry = Object.fromEntries(Object.entries(fixtures).filter(([id]) => id.startsWith('button.')));
  runNativeScenarios({
    root, registry, appId: 'org.uilazydev.qualification', platform: 'ios', device: 'test', maestro: 'maestro',
    reports: root, log() {}, reset: id => resets.push(id), run(_root, _command, args) {
      if (args[2] !== 'test') throw Error('Unexpected driver request ' + args[2]);
      const [header, steps] = readFileSync(args.at(-1), 'utf8').split('\n---\n').map(part => JSON.parse(part));
      flows.push({ name: header.name, steps });
    },
  });
  const single = flows.find(flow => flow.name === 'button.pending-keeps-name');
  const double = flows.find(flow => flow.name === 'button.pending-keeps-name.double-press');
  assert.ok(single?.steps.some(step => step.tapOn?.text === '^Save$' && !step.tapOn.repeat));
  assert.ok(double, 'Missing independent repeated press on the pending-once fixture');
  assert.ok(resets.includes(double.name), 'Reset the app before the second journey');
  assert.ok(double.steps.some(step => step.tapOn?.id === '^fixture\\.button\\.pending-once$'));
  const tap = double.steps.findIndex(step => step.tapOn?.text === '^Save$' && step.tapOn.repeat === 2 && step.tapOn.delay === 80);
  assert.ok(tap >= 0, 'A single Maestro command must send both presses');
  assert.ok(double.steps.slice(tap + 1).some(step => step.assertVisible?.text === '^Saved once$'));
  assert.ok(double.steps.slice(tap + 1).some(step => step.assertVisible?.text === '^Save$' && step.assertVisible.enabled === false));
});

test('Android role reads preserve busy focus checks without sending an empty Maestro flow', async () => {
  const { runQualifiedNativeScenarios } = await import('../../../tests/simulator/scenarios.mjs');
  assert.throws(() => runQualifiedNativeScenarios({ readRoles() {} }), /requires a device reset/);
  const root = resolve(import.meta.dirname, '../../..');
  const registry = Object.fromEntries(Object.entries(fixtures).filter(([id]) => id.startsWith('button.')));
  let busy = false;
  let busyReads = 0;
  const nodes = () => ['Save', 'Saved once', 'Archive', 'Not archived'].map(name => {
    const isButton = name === 'Save' || name === 'Archive';
    return { 'resource-id': 'scenario.' + (isButton ? 'button' : 'text') + '.' + name,
      class: isButton ? 'android.widget.Button' : 'android.widget.TextView',
      'content-desc': name === 'Save' && busy ? 'Save, busy' : name,
      enabled: String(!(busy && name === 'Save')), focusable: 'true' };
  });
  const ids = runQualifiedNativeScenarios({
    root, registry, appId: 'org.uilazydev.qualification', platform: 'android', device: 'test', maestro: 'maestro',
    reports: root, log() {}, reset() { busy = false; }, readRoles: nodes,
    readAndroidTree() { busyReads++; return nodes(); },
    run(_root, _command, args) {
      const [header, steps] = readFileSync(args.at(-1), 'utf8').split('\n---\n').map(part => JSON.parse(part));
      assert.ok(steps.length > 0, header.name + ' sent an empty Maestro flow');
      if (header.name === 'button.pending-keeps-name' && steps.some(step => step.tapOn?.text === '^Save$')) busy = true;
    },
  });
  assert.ok(ids.includes('button.pending-keeps-name'));
  assert.equal(busyReads, 1, 'The pending step must still inspect the busy Button and focusability');
});

test('the dark Button needs both its measured fill and its label color inside its own bounds', async () => {
  const { assertDarkButtonPixels } = await import('../../../tests/simulator/button-pixels.mjs');
  const screenshot = { pixels: 104328, fill: 101176, label: 1631 };
  assert.doesNotThrow(() => assertDarkButtonPixels(screenshot));
  assert.throws(() => assertDarkButtonPixels({ ...screenshot, fill: 0 }), /fill/);
  assert.throws(() => assertDarkButtonPixels({ ...screenshot, label: 0 }), /label/);
  assert.throws(() => assertDarkButtonPixels({ ...screenshot, pixels: 0 }), /region/);
});

test('device roles use native classes, XCTest element types or accessibility values as well as identifiers', async () => {
  const { classOrTypeRoles, verifyNativeRole } = await import('../../../tests/simulator/scenarios.mjs');
  for (const role of ['button', 'text', 'alert']) assert.ok(classOrTypeRoles.android.includes(role));
  for (const role of ['button', 'text']) assert.ok(classOrTypeRoles.ios.includes(role));
  // Real XCTest observation on the integration app. A text element with the
  // expected identifier and label provides no evidence of an alert role.
  const error = 'Could not save changes. Try again.';
  assert.throws(() => verifyNativeRole({
    identifier: 'scenario.alert.' + error, label: error, elementType: 48, value: null,
  }, 'ios', { role: 'alert', name: error }), /iOS role/);
  const name = 'Save';
  for (const [role, androidClass, iosType] of [
    ['button', 'android.widget.Button', 9], ['text', 'android.widget.TextView', 48], ['alert', 'android.view.View', 7],
  ]) {
    const id = 'scenario.' + role + '.' + name;
    const android = { 'resource-id': id, text: name, class: androidClass,
      ...(role === 'alert' ? { roleDescription: 'Alert' } : {}) };
    const ios = { identifier: id, label: name, elementType: iosType };
    assert.doesNotThrow(() => verifyNativeRole([android], 'android', { role, name }));
    assert.doesNotThrow(() => verifyNativeRole(ios, 'ios', { role, name }));
    assert.throws(() => verifyNativeRole([{ ...android, class: 'android.widget.ImageView' }], 'android', { role, name }), /role/);
    assert.throws(() => verifyNativeRole({ ...ios, elementType: 1 }, 'ios', { role, name }), /role/);
    assert.throws(() => verifyNativeRole({ children: [ios, ios] }, 'ios', { role, name }), /unique/);
  }
});

test('phone receipts keep the exact dark Button PNG beside its replay inputs after cleanup', t => {
  const scratch = mkdtempSync(join(tmpdir(), 'uld-button-receipt-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const directory = join(scratch, 'receipts');
  const runner = readFileSync(new URL('../local-run.mjs', import.meta.url), 'utf8');
  const collector = runner.match(/    const patterns = [\s\S]*?(?=    const timing = )/);
  assert.ok(collector, 'Expected the device evidence collector');
  const image = readFileSync(new URL('../../../tests/simulator/button-dark-control.png', import.meta.url));
  for (const [platform, profile] of [['iphone', ''], ['android', 'standard'], ['android', 'low-end']]) {
    const root = join(scratch, 'snapshot');
    const step = join(profile, 'maestro-session-example', '2');
    const inputs = {
      'request.json': JSON.stringify({ op: 'button-pixels', rect: { x: 3, y: 3, right: 357, bottom: 66 }, fill: '#bde8be', label: '#18211d' }),
      'counts.json': JSON.stringify({ pixels: 200718, fill: 171032, label: 24743, gridWidth: 360, gridHeight: 69 }),
      'dark-button.png': image,
    };
    mkdirSync(join(root, step), { recursive: true });
    for (const [file, data] of Object.entries(inputs)) writeFileSync(join(root, step, file), data);
    new Script(collector[0]).runInNewContext({ directory, root, platform, id: 'trial', globSync, mkdirSync, copyFileSync, dirname, join });
    rmSync(root, { recursive: true });
    for (const [file, data] of Object.entries(inputs)) {
      assert.deepEqual(readFileSync(join(directory, 'attempts/trial-evidence', platform, step, file)), Buffer.from(data));
    }
  }
});

test('an Android alert requires its observed accessibility role description', async () => {
  const { verifyNativeRole } = await import('../../../tests/simulator/scenarios.mjs');
  const target = { role: 'alert', name: 'Could not save changes. Try again.' };
  const plain = { 'resource-id': 'scenario.alert.' + target.name, text: target.name, class: 'android.view.View' };
  for (const roleDescription of [undefined, '', 'Heading']) {
    assert.throws(() => verifyNativeRole([{ ...plain, roleDescription }], 'android', target), /alert role description/);
  }
  const { readScenarioRoles } = await import('../../../tests/android/tree.mjs');
  const row = { ...plain, roleDescription: 'Alert' };
  const dump = (...rows) => () => ['ACTIVITY example', ...rows.map(item => '    ULD_ALERT ' + JSON.stringify(item))].join('\n');
  const observed = (...rows) => readScenarioRoles([{ ...plain }], [target], dump(...rows));
  verifyNativeRole(observed(row), 'android', target);
  assert.throws(() => verifyNativeRole(observed(plain), 'android', target), /alert role description/);
  for (const rows of [[], [{ ...row, 'resource-id': 'other' }], [row, row]]) {
    assert.throws(() => observed(...rows), /unique accessibility node/);
  }
  assert.throws(() => observed({ ...row, text: 'Other' }), /accessible name/);
  assert.throws(() => observed({ ...row, class: 'android.widget.TextView' }), /node class/);
});
