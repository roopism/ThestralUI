import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync,
  realpathSync, renameSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';

const timer = new Int32Array(new SharedArrayBuffer(4));
export function waitUntil(check, timeout, reason) {
  const deadline = performance.now() + timeout;
  do {
    const value = check();
    if (value) return value;
    Atomics.wait(timer, 0, 0, 100);
  } while (performance.now() < deadline);
  throw Error(reason);
}

export function withMaestroSession({ platform, device, maestro, env, reports }, check) {
  const executable = realpathSync(maestro);
  const library = join(dirname(dirname(executable)), 'lib', '*');
  mkdirSync(reports, { recursive: true });
  const folder = mkdtempSync(join(reports, 'maestro-session-'));
  execFileSync('javac', ['-cp', library, '-d', folder, resolve('tests/simulator/MaestroSession.java')], { env });
  const log = openSync(join(folder, 'driver.log'), 'wx');
  let driver;
  try {
    driver = spawn('java', ['-cp', folder + delimiter + library, 'MaestroSession', folder, device, platform],
      { env, stdio: ['ignore', log, log] });
  } finally { closeSync(log); }
  assert.ok(driver.pid > 1, 'Cannot start maintained Maestro session');
  const waitFor = (path, timeout) => waitUntil(() => {
    if (existsSync(path)) return true;
    process.kill(driver.pid, 0);
    const state = execFileSync('/bin/ps', ['-p', String(driver.pid), '-o', 'state='], { encoding: 'utf8' }).trim();
    assert.ok(state && !state.startsWith('Z'), 'Maestro exited. See ' + join(folder, 'driver.log'));
    return false;
  }, timeout, 'Maestro did not respond. See ' + folder);
  let sequence = 0, ready = false;
  function request(payload) {
    const step = join(folder, String(++sequence));
    mkdirSync(step);
    writeFileSync(join(step, 'pending.json'), JSON.stringify(payload));
    renameSync(join(step, 'pending.json'), join(step, 'request.json'));
    waitFor(join(step, 'reply.json'), payload.op === 'quit' ? 10000 : 25 * 60_000);
    const reply = JSON.parse(readFileSync(join(step, 'reply.json')));
    assert.ok(reply.ok, (reply.error ?? 'Maestro failed') + ' — ' + step);
    return step;
  }
  function run(cwd, command, args) {
    assert.equal(command, maestro);
    assert.deepEqual(args.slice(0, 2), ['--device', device]);
    if (args[2] === 'hierarchy') return readFileSync(join(request({ op: 'hierarchy' }), 'hierarchy.json'), 'utf8');
    assert.equal(args[2], 'test');
    const options = { env: {}, artifacts: folder, op: 'test', flow: resolve(cwd, args.at(-1)) };
    let output;
    for (let i = 3; i < args.length - 1; i += 2) {
      const [option, value] = args.slice(i, i + 2);
      switch (option) {
        case '-e': {
          const split = value.indexOf('=');
          assert.ok(split > 0);
          options.env[value.slice(0, split)] = value.slice(split + 1);
          break;
        }
        case '--format': assert.equal(value, 'JUNIT'); break;
        case '--output': output = value; break;
        case '--debug-output': options.artifacts = value; break;
        case '--test-output-dir': mkdirSync(value, { recursive: true }); break;
        default: throw Error('Unsupported Maestro option ' + option);
      }
    }
    const step = request(options);
    if (output) copyFileSync(join(step, 'junit.xml'), output);
    return readFileSync(join(step, 'suite.json'), 'utf8');
  }
  try {
    waitFor(join(folder, 'ready.json'), 360000);
    const handshake = JSON.parse(readFileSync(join(folder, 'ready.json')));
    assert.equal(handshake.pid, driver.pid);
    assert.equal(handshake.device, device);
    ready = true;
    return check(run, {
      reconnectIOS: () => request({ op: 'reconnect-ios' }),
      androidXML: () => readFileSync(join(request({ op: 'android-xml' }), 'nodes.xml'), 'utf8'),
    });
  } finally {
    try { if (ready) request({ op: 'quit' }); }
    finally { if (!ready || !existsSync(join(folder, String(sequence), 'reply.json'))) driver.kill('SIGTERM'); }
  }
}
