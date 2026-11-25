import { withHostCache } from '../../scripts/workers/resource-guard.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageWorkspaces, runtimeWorkspaces, selectArchives } from '../../scripts/package-workspaces.mjs';
import { abi } from './emulator.mjs';
import {
  androidAppId,
  androidHermesc,
  androidHostKey,
  buildAndroidHost,
  bundleJavaScript,
  hostsDir,
  deviceHost,
  injectAndroidApk,
  installArchives,
  stageAndroidJavaScript,
} from '../../scripts/build-cache/device-host.mjs';

export const appId = androidAppId;

// The compiled APK is reused for unchanged native inputs. Each run installs the candidate
// archives in the host, bundles and compiles its JavaScript, and signs a copy of the APK.
export async function preparePackedApk(root, evidence, android, out) {
  const started = Date.now();
  const packages = packageWorkspaces(root);
  const roots = ['@ui-lazy-dev/ui-native'];
  if (packages.has('@ui-lazy-dev/icons')) roots.push('@ui-lazy-dev/icons');
  const provenance = JSON.parse(readFileSync(join(evidence, 'provenance.json'), 'utf8'));
  const archives = selectArchives(provenance.packages, runtimeWorkspaces(packages, roots)).map(
    (archive) => {
      const path = join(evidence, archive.filename);
      assert.equal(
        createHash('sha256').update(readFileSync(path)).digest('hex'),
        archive.sha256,
        'Invalid packed archive ' + archive.name,
      );
      return { ...archive, path };
    },
  );
  const probes = join(root, 'tests/android');
  const key = androidHostKey(root, archives, android, abi);
  const { host, bundle, apk } = await withHostCache(hostsDir(), 'android', () => {
    const host = deviceHost(hostsDir(), 'android', key, (dir) =>
      buildAndroidHost(root, dir, { archives, android, abi, probes }),
    );
    installArchives(host.dir, archives);
    stageAndroidJavaScript(root, host.dir, probes);
    const bundle = bundleJavaScript(host.dir, {
      platform: 'android',
      hermesc: androidHermesc(host.dir),
      out: join(out, 'bundle'),
      extra: ['--max-workers', '2'],
    });
    const apk = injectAndroidApk(host.dir, bundle, join(out, 'apk'), { android, abi });
    return { host, bundle, apk };
  });
  const setupSeconds = Math.round((Date.now() - started) / 1000);
  console.log(
    (host.built ? 'Built the Android host ' : 'Reused the Android host ') + key.slice(0, 12) +
      '; APK ready in ' + setupSeconds + ' s.',
  );
  return { apk, archives, host: { key, built: host.built, setupSeconds, bundleSha256: bundle.sha256 } };
}
