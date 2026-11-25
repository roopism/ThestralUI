import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const maestroVersion = '2.12.1';
const sha256 = '54dbb0716425626604973cbb374c585ca30272375d9ce15177a1152765ddd9d7';
const url =
  'https://github.com/mobile-dev-inc/Maestro/releases/download/cli-' +
  maestroVersion +
  '/maestro.zip';
const port = '6209';

export async function androidMaestro(env) {
  const cacheRoot =
    env.XDG_CACHE_HOME ||
    (process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Caches')
      : join(homedir(), '.cache'));
  const cache = join(cacheRoot, 'ui-lazy-dev', 'android-maestro');
  const install = join(cache, maestroVersion);
  const executable = env.MAESTRO_ANDROID_BIN || join(install, 'bin', 'maestro');
  const home = join(cache, 'driver-home');
  mkdirSync(home, { recursive: true });
  if (!env.MAESTRO_ANDROID_BIN && !existsSync(executable)) {
    const stage = mkdtempSync(join(cache, 'install-'));
    try {
      const archive = join(stage, 'maestro.zip');
      execFileSync(
        'curl',
        [
          '--fail',
          '--location',
          '--silent',
          '--show-error',
          '--retry',
          '2',
          '--output',
          archive,
          url,
        ],
        { env },
      );
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(archive)) hash.update(chunk);
      assert.equal(hash.digest('hex'), sha256, 'Android Maestro archive digest mismatch');
      execFileSync('unzip', ['-q', archive, '-d', stage], { env });
      renameSync(join(stage, 'maestro'), install);
    } finally {
      rmSync(stage, { recursive: true, force: true });
    }
  }
  // Legacy iOS CLIs treat every active Maestro session as an iOS session, irrespective of device.
  const driverEnv = {
    ...env,
    JAVA_TOOL_OPTIONS: [env.JAVA_TOOL_OPTIONS, '"-Duser.home=' + home + '"']
      .filter(Boolean)
      .join(' '),
    MAESTRO_DRIVER_STARTUP_TIMEOUT: '360000',
  };
  const version = execFileSync(executable, ['--version'], { env: driverEnv, encoding: 'utf8' });
  assert.ok(
    version.trim().split(/\s+/).includes(maestroVersion),
    'Android requires Maestro ' + maestroVersion,
  );
  return {
    executable,
    env: driverEnv,
    run(cwd, command, args, options = {}) {
      return execFileSync(command, ['--driver-host-port', port, ...args], {
        cwd,
        encoding: 'utf8',
        timeout: 25 * 60000,
        maxBuffer: 32 * 1024 * 1024,
        ...options,
      });
    },
  };
}
