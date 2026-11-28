import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNativeScenarios } from '../../tests/simulator/scenarios.mjs';

// Offline canaries for the native role vocabulary. No simulator, emulator or device is used.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = mkdtempSync(join(tmpdir(), 'uld-native-role-canaries-'));
const maestro = process.env.MAESTRO_BIN || join(homedir(), '.maestro/bin/maestro');
const registry = { 'canary.example': { label: 'Canary example', render: () => null } };
let sequence = 0;
function scenario(steps, { platform, android, ios, interactions = true }) {
  const checkout = join(dir, String(++sequence));
  mkdirSync(join(checkout, 'docs/components'), { recursive: true });
  writeFileSync(join(checkout, 'docs/components/canary.scenarios.yaml'),
    JSON.stringify({ family: 'Canary', scenarios: [{ id: 'canary.roles', fixture: 'example', steps }] }));
  const flows = [];
  const run = (_cwd, _command, args) => {
    assert.ok(interactions, 'The canary reached the device driver');
    // The adapter rewrites and removes its flow files. Keep a copy of each one for the parser.
    const copy = join(checkout, 'flow-' + flows.length + '.yaml');
    writeFileSync(copy, readFileSync(args.at(-1), 'utf8'));
    flows.push(copy);
    return '';
  };
  runNativeScenarios({ root: checkout, registry, run, platform, reports: checkout, log() {}, maestro: 'maestro',
    device: 'canary-device', appId: 'org.uilazydev.canary', env: {}, readAndroidTree: () => android, readIOSElements: () => ios });
  return flows;
}
const step = (role, name, act) => act ? { act: 'activate', target: { role, name } } : { expect: 'visible', target: { role, name } };
const ios = (identifier, label, elementType, value) => ({ elementType: 1, identifier: '', label: '', children: [
  { identifier, label, elementType, ...(value === undefined ? {} : { value }), children: [] }] });
const android = (id, name, cls) => [{ 'resource-id': 'org.uilazydev.canary:id/' + id, 'content-desc': name, text: '', class: cls }];
function rejects(name, action, expected) {
  assert.throws(action, expected, name + ' was accepted');
  console.log('Rejected', name);
}

try {
  for (const platform of ['ios', 'android']) {
    rejects(platform + ' unsupported role tooltip', () => scenario([step('tooltip', 'Hint')], { platform, interactions: false }),
      /canary.roles step 1: Role tooltip is not supported on native/);
    rejects(platform + ' unknown role carousel', () => scenario([step('carousel', 'Slides')], { platform, interactions: false }),
      /Unknown neutral role carousel is not supported on native/);
    rejects(platform + ' activation of a heading', () => scenario([step('heading', 'Overview', true)], { platform, interactions: false }),
      /unsupported native activation role heading/);
  }
  rejects('iOS heading exposed as a button', () => scenario([step('heading', 'Overview')],
    { platform: 'ios', ios: ios('scenario.heading.Overview', 'Overview', 9) }), /belongs to another role/);
  rejects('iOS switch without a switch value', () => scenario([step('switch', 'Alerts', true)],
    { platform: 'ios', ios: ios('scenario.switch.Alerts', 'Alerts', 9, 'checkbox, checked') }), /native switch role and state/);
  rejects('Android heading exposed as a button', () => scenario([step('heading', 'Overview')],
    { platform: 'android', android: android('scenario.heading.Overview', 'Overview', 'android.widget.Button') }), /is not android.view.View/);
  rejects('Android separator exposed with a role class', () => scenario([step('separator', 'Sections')],
    { platform: 'android', android: android('scenario.separator.Sections', 'Sections', 'android.view.View') }), /is not android.view.ViewGroup/);

  // Controls: the matching roles pass, and every generated flow parses in the installed Maestro.
  const flows = [
    ...scenario([step('heading', 'Overview'), step('link', 'Help', true)], { platform: 'ios',
      ios: { elementType: 1, identifier: '', label: '', children: [
        { identifier: 'scenario.heading.Overview', label: 'Overview', elementType: 1, children: [] },
        { identifier: 'scenario.link.Help', label: 'Help', elementType: 42, children: [] }] } }),
    ...scenario([step('switch', 'Alerts', true), step('separator', 'Sections')], { platform: 'android',
      android: [...android('scenario.switch.Alerts', 'Alerts', 'android.widget.Switch'),
        ...android('scenario.separator.Sections', 'Sections', 'android.view.ViewGroup')] }),
  ];
  assert.ok(flows.length >= 2, 'The control scenarios generated no flows');
  for (const flow of flows) execFileSync(maestro, ['check-syntax', flow], { env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1' }, encoding: 'utf8' });
  console.log('Matching native roles passed. Maestro parsed', flows.length, 'generated flows.');

  // The iOS bridge compiles against the installed Maestro and serializes the XCTest element type.
  const library = join(dirname(dirname(execFileSync('realpath', [maestro], { encoding: 'utf8' }).trim())), 'lib', '*');
  const classes = join(dir, 'classes');
  execFileSync('javac', ['-cp', library, '-d', classes, join(root, 'tests/simulator/MaestroSession.java')]);
  execFileSync('javac', ['-cp', classes, '-d', classes, join(root, 'tests/simulator/ButtonPixelControl.java')]);
  execFileSync('java', ['-cp', classes, 'ButtonPixelControl', join(root, 'tests/simulator/button-dark-control.png')]);
  console.log('The single-source bridge counted the PNG crop and recorded its replay grid.');
  writeFileSync(join(dir, 'ElementShape.java'), `
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.module.kotlin.KotlinModule;
import hierarchy.AXElement;
import hierarchy.AXFrame;
import java.util.ArrayList;
public final class ElementShape {
  public static void main(String[] args) throws Exception {
    ObjectMapper json = new ObjectMapper().registerModule(new KotlinModule.Builder().build())
      .setSerializationInclusion(JsonInclude.Include.NON_NULL);
    AXFrame frame = new AXFrame(0f, 0f, 10f, 10f);
    System.out.println(json.writeValueAsString(new AXElement("Help", 42, "scenario.link.Help", 0, 0L, 0, false, 0, false,
      null, "1", frame, true, null, new ArrayList<>())));
  }
}
`);
  execFileSync('javac', ['-cp', library, '-d', classes, join(dir, 'ElementShape.java')]);
  const shape = spawnSync('java', ['-cp', classes + ':' + library, 'ElementShape'], { encoding: 'utf8' });
  assert.equal(shape.status, 0, shape.stderr);
  const element = JSON.parse(shape.stdout);
  assert.deepEqual([element.identifier, element.label, element.elementType, element.value, element.children],
    ['scenario.link.Help', 'Help', 42, '1', []]);
  console.log('The iOS bridge compiled and its raw element keeps identifier, label, element type and value.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
