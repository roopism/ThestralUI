import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { waitUntil } from './maestro-session.mjs';

export function iosWindow(sim, device, app) {
  const since = execFileSync('/bin/date', ['+%Y-%m-%d %H:%M:%S'], { encoding: 'utf8' }).trim();
  const launch = sim('launch', '--terminate-running-process', device, app);
  const pid = Number(launch.match(/:\s*(\d+)$/)?.[1]);
  assert.ok(Number.isSafeInteger(pid) && pid > 1, 'Missing gallery process');
  waitUntil(() => {
    const log = sim('spawn', device, 'log', 'show', '--start', since, '--style', 'compact', '--predicate',
      '(processID == ' + pid + ' AND category == "KeyWindow") OR (process == "SpringBoard" AND eventMessage CONTAINS "[app<' + app + '>:' + pid + '] Setting process visibility to:")');
    const lines = log.split('\n');
    const foreground = lines.filter(line => line.includes('[app<' + app + '>:' + pid + '] Setting process visibility to:')).at(-1);
    const key = lines.filter(line => line.includes('HelloWorld[' + pid + ':') && /Window (?:became key|resign(?:ed|ing) key)/i.test(line)).at(-1);
    return foreground?.endsWith('Foreground') && /Window became key in scene: UIWindow: 0x[0-9a-f]+/i.test(key ?? '');
  }, 60000, 'Gallery did not acquire its iPhone window');
}
export function androidWindow(device, app) {
  assert.match(device('shell', 'pm', 'clear', app), /Success/);
  const launch = device('shell', 'am', 'start', '-W', '-n', app + '/com.helloworld.MainActivity');
  assert.match(launch, /Status: ok/);
  waitUntil(() => device('shell', 'dumpsys', 'window').split('\n')
    .some(line => line.includes('mCurrentFocus=Window{') && line.includes(app + '/')),
  60000, 'Gallery did not acquire its Android window');
}
