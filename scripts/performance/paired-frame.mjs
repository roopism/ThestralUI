import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installSnapshotDependencies } from '../../packages/policy/quality/snapshot-dependencies.mjs';

const probe = fileURLToPath(new URL('./paired-frame-probe.mjs', import.meta.url));
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {
  encoding: 'utf8', timeout: 20_000, maxBuffer: 1024 * 1024,
}).trim();

// The build has a shell and compiler children. Give its process group a finite
// lifetime, including when a timed-out child keeps an inherited descriptor open.
export function runBounded(command, args, options, timeout) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { ...options, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '', expired = false, grace;
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { tail = (tail + chunk).slice(-1600); });
    function releaseStreams() {
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
    }
    // Only the still-running leader identifies this process group as ours. Once
    // it exits the numeric group ID may have been reused by an unrelated job.
    const signal = type => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      try {
        process.kill(-child.pid, type);
      } catch (error) {
        if (error.code !== 'ESRCH') {
          releaseStreams();
          reject(error);
        }
      }
    };
    const timer = setTimeout(() => {
      expired = true;
      signal('SIGTERM');
      grace = setTimeout(() => {
        signal('SIGKILL');
        releaseStreams();
        reject(Error('Diagnostic deadline exceeded'));
      }, 1500);
    }, timeout);
    child.once('error', error => { clearTimeout(timer); clearTimeout(grace); reject(error); });
    child.once('close', (code, signalName) => {
      clearTimeout(timer); clearTimeout(grace);
      if (expired || code !== 0) reject(Error(expired ? 'Diagnostic deadline exceeded' : tail || 'Process exited ' + (signalName || code)));
      else done();
    });
  });
}

export function verifiedHostedRevisions(root, event, checkout, selectedTree) {
  const previous = event.pull_request?.base?.sha;
  for (const oid of [previous, checkout]) assert.match(oid ?? '', /^[a-f0-9]{40}$/);
  assert.equal(git(root, 'rev-parse', checkout + '^{tree}'), selectedTree, 'Hosted checkout differs from tested snapshot');
  git(root, 'merge-base', '--is-ancestor', previous, checkout);
  assert.equal(git(root, 'rev-parse', previous + ':package-lock.json'), git(root, 'rev-parse', checkout + ':package-lock.json'),
    'The base and checkout require different dependency locks');
  return { base: previous, candidate: checkout };
}

export async function runPairedCatalogs(catalogs, output, end = Date.now() + 260_000) {
  const arms = [];
  for (const role of ['base', 'candidate', 'candidate', 'base']) {
    const file = join(output, 'arm-' + (arms.length + 1) + '-' + role + '.json');
    const arm = { role, startedAt: new Date().toISOString() };
    arms.push(arm);
    const available = end - Date.now();
    if (available < 1000) { arm.unavailable = 'Overall diagnostic deadline reached'; continue; }
    try {
      await runBounded(process.execPath, [probe, catalogs[role], file], {}, Math.min(70_000, available));
    } catch (error) {
      arm.unavailable = error.message;
    }
    if (existsSync(file)) arm.samples = JSON.parse(readFileSync(file, 'utf8'));
    arm.finishedAt = new Date().toISOString();
  }
  return arms;
}

// The ordinary gate has already built and tested the current snapshot. Build the
// identified PR base only after a hosted failure. Neither build can supply the harness.
export async function pairedHostedFrames(candidateCatalog, env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'pull_request')
    return { applicable: false, reason: 'A GitHub pull request supplies the verified base and tested checkout' };
  const root = env.GITHUB_WORKSPACE;
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const selection = JSON.parse(readFileSync('.git/gate-selection.json', 'utf8'));
  const revisions = verifiedHostedRevisions(root, event, env.GITHUB_SHA, selection.tree);
  const scratch = mkdtempSync(join(tmpdir(), 'uld-hosted-frame-pair-'));
  const base = join(scratch, 'base'), tar = join(scratch, 'base.tar');
  const output = { revisions, candidateTree: selection.tree, baseTree: git(root, 'rev-parse', revisions.base + '^{tree}'),
    sourceLock: git(root, 'rev-parse', revisions.base + ':package-lock.json'), throttle: 4, order: 'ABBA',
    recording: { open: 'Chromium trace', typing: 'Chromium trace', scroll: 'none', motion: 'Playwright video' } };
  const start = Date.now();
  try {
    mkdirSync(base);
    execFileSync('git', ['-C', root, 'archive', '--format=tar', '--output', tar, revisions.base], { timeout: 25_000 });
    execFileSync('tar', ['-xf', tar, '-C', base], { timeout: 25_000 });
    const common = git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
    // The official snapshot populated this exact lock and manifest cache before the failure.
    installSnapshotDependencies(base, join(common, 'uld-dependencies'), env, () => {
      throw Error('The verified base needs an uncached dependency installation');
    });
    await runBounded('npm', ['run', 'build'], {cwd: base, env}, 105_000);
    output.arms = await runPairedCatalogs({ base: join(base, 'dist/catalog'), candidate: resolve(candidateCatalog) }, scratch, start + 260_000);
  } catch (error) {
    output.unavailable = error.message;
  } finally {
    output.elapsedMs = Date.now() - start;
    rmSync(scratch, { force: true, recursive: true });
  }
  return output;
}
