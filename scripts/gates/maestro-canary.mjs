import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { withLock } from '../workers/lock.mjs';
import { pickPhone, prepareIOSJourney, startIOSJourneySession } from '../verify-ios-simulator.mjs';
import { iosBundleId } from '../build-cache/device-host.mjs';
import { iosWindow } from '../../tests/simulator/window-ready.mjs';
import { withMaestroSession } from '../../tests/simulator/maestro-session.mjs';

const commands = ['assertVisible', 'assertNotVisible', 'assertVisible'];
function controlFlow(command, index) {
  return JSON.stringify({ appId: iosBundleId, name: 'Gallery assertion ' + index }) +
    '\n---\n' + JSON.stringify([{ [command]: { id: '^open-scenarios$', text: '^Component scenarios$' } }]) + '\n';
}

if (process.argv[2] === '--offline') {
  const operations = commands.map((command, index) => {
    const [header, steps] = yaml.safeLoadAll(controlFlow(command, index));
    assert.equal(header.appId, iosBundleId);
    assert.equal(steps.length, 1);
    const [operation] = Object.keys(steps[0]);
    assert.deepEqual(steps[0], { [operation]: { id: '^open-scenarios$', text: '^Component scenarios$' } });
    return operation;
  });
  assert.deepEqual(operations, ['assertVisible', 'assertNotVisible', 'assertVisible']);
  const folder = mkdtempSync(join(tmpdir(), 'uld-maestro-parser-'));
  try {
    const cli = process.env.MAESTRO_BIN || join(homedir(), '.maestro/bin/maestro');
    const env = { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1' };
    const good = join(folder, 'valid.yaml'), broken = join(folder, 'invalid.yaml');
    const selector = { id: '^open-scenarios$', text: '^Component scenarios$' };
    writeFileSync(good, JSON.stringify({ appId: iosBundleId }) + '\n---\n' +
      JSON.stringify(operations.map(op => ({ [op]: selector }))) + '\n');
    writeFileSync(broken, controlFlow('invalidFixtureCommand', 0));
    execFileSync(cli, ['check-syntax', good], { env, encoding: 'utf8' });
    const rejected = spawnSync(cli, ['check-syntax', broken], { env, encoding: 'utf8' });
    if (rejected.error) throw rejected.error;
    assert.equal(rejected.status, 1, 'Maestro parser accepted the invalid command');
    assert.match(rejected.stdout + rejected.stderr, /Invalid Command: invalidFixtureCommand/i);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  console.log('Validated the three Maestro control flows offline.');
  process.exit(0);
}

const root = process.cwd(), app = resolve(process.argv[2] ?? '');
assert.ok(app.endsWith('.app') && existsSync(join(app, 'main.jsbundle')), 'Pass a built qualification gallery app');
const sim = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' }).trim();
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
const parent = join(common, 'uld-delivery', 'session-controls');
mkdirSync(parent, { recursive: true });
const reports = mkdtempSync(join(parent, 'ios-'));
const { udid, runtime } = pickPhone(JSON.parse(sim('list', 'devices', 'available', '-j')).devices, process.env.UI_SIMULATOR_ID);
const maestro = join(homedir(), '.maestro/bin/maestro'), env = process.env;
await withLock(root, 'integration', 'Driver canary', () => withLock(root, 'simulator', 'Live assertion control', () => {
  startIOSJourneySession(udid, false, sim);
  sim('install', udid, app);
  const appearance = sim('ui', udid, 'appearance'), size = sim('ui', udid, 'content_size');
  const observed = [];
  const reset = (next = appearance, reconnect) => { prepareIOSJourney(udid, app, next, size, sim, reconnect); iosWindow(sim, udid, iosBundleId); };
  reset();
  withMaestroSession({ platform: 'ios', device: udid, maestro, env, reports }, (run, { reconnectIOS: reconnect }) => {
    for (const [index, command] of commands.entries()) {
      if (index) reset(index === 1 ? (appearance === 'light' ? 'dark' : 'light') : appearance, reconnect);
      const file = join(reports, 'control-' + index + '.yaml');
      writeFileSync(file, controlFlow(command, index));
      const invoke = () => run(root, maestro, ['--device', udid, 'test', '--test-output-dir', reports, '--debug-output', join(reports, 'step-' + index), file]);
      if (index === 1) {
        assert.throws(invoke, /Maestro flow failed/);
        const session = readdirSync(reports).find(name => name.startsWith('maestro-session-'));
        const directory = join(reports, session);
        const step = readdirSync(directory).find(name => {
          const request = join(directory, name, 'request.json');
          return existsSync(request) && JSON.parse(readFileSync(request)).flow === file;
        });
        assert.ok(step, 'Missing recorded control request');
        const result = JSON.parse(readFileSync(join(directory, step, 'suite.json')));
        assert.equal(result.passed, false);
        assert.equal(result.suites[0].flows[0].status, 'ERROR');
        assert.match(JSON.stringify(result), /assert|visible/i);
        assert.match(result.suites[0].flows[0].failure.message, /Assertion is false:.*open-scenarios.*is not visible/);
        observed.push('wrong assertion failed');
      } else { invoke(); observed.push('correct assertion passed'); }
    }
  });
  writeFileSync(join(reports, 'proof.json'), JSON.stringify({ device: udid, runtime, observed }, null, 2) + '\n');
}));
console.log(reports);
