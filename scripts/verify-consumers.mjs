import { installLockedConsumer } from './gates/packed-install.mjs';
import { packageWorkspaces, runtimeWorkspaces, selectArchives } from './package-workspaces.mjs';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { command, root, readJson, saveJson } from './verify-artifacts.mjs';
import { bundleImports, measureBundles } from './verify-bundles.mjs';
import { familyInputs, previousBundleFamilies } from './manifests/bundle-parent.mjs';
import { checkPackedBudgetAdoption, incumbentEntries } from './manifests/reviewed-bundle-budgets.mjs';
import { measureDefaultTransfer } from './measure-default-transfer.mjs';
import { verifyHydration, verifyNext } from './verify-hydration.mjs';
import { sha256, validateBom, verifyBaseline } from './verify-policy.mjs';

const output = resolve(process.argv[2] || 'release/evidence');
const provenance = readJson(join(output, 'provenance.json'));
const previous = verifyBaseline().map(path => {
  const manifest = JSON.parse(command(root, 'tar', ['-xOzf', path, 'package/package.json']));
  return { name: manifest.name, path };
});
const web = runtimeWorkspaces(packageWorkspaces(root), [...bundleImports().keys()]);
const candidate = selectArchives(provenance.packages, web).map(pkg => {
  const path = join(output, pkg.filename);
  assert.equal(sha256(readFileSync(path)), pkg.sha256, 'Candidate digest mismatch');
  return { name: pkg.name, path };
});
const pairs = [
  { label: 'min', react: '19.0.0', next: '16.4.5' },
  {
    label: 'max',
    react: readJson(join(root, 'package.json')).devDependencies.react,
    next: '16.4.6',
  },
];
const selected = process.argv[3];
assert.ok(!selected || pairs.some((pair) => pair.label === selected), 'Choose min or max');
const browser = await chromium.launch();
try {
  for (const pair of pairs.filter((pair) => !selected || pair.label === selected)) {
    const directory = mkdtempSync(join(tmpdir(), 'ui-consumer-'));
    const cwd = join(directory, 'app');
    const evidence = [];
    try {
      cpSync(join(root, 'tests/packaging/fixture'), cwd, { recursive: true });
      const specs = {};
      for (const [label, paths] of [
        ['previous', previous],
        ['candidate', candidate],
      ]) {
        const folder = join(directory, label);
        mkdirSync(folder);
        specs[label] = Object.fromEntries(paths.map(({ name, path }) => {
          const target = join(folder, basename(path));
          cpSync(path, target);
          return [name, 'file:' + relative(cwd, target)];
        }));
      }
      const fixture = {
        name: 'ui-release-fixture',
        version: '1.0.0',
        private: true,
        type: 'module',
      };
      for (const [phase, label] of [
        ['baseline', 'previous'],
        ['upgrade', 'candidate'],
        ['rollback', 'previous'],
      ]) {
        console.log(pair.label + ': ' + phase);
        const dependencies = { react: pair.react, 'react-dom': pair.react, ...specs[label] };
        saveJson(join(cwd, 'package.json'), { ...fixture, dependencies });
        installLockedConsumer(cwd, 'web-' + pair.label + (label === 'previous' ? '-base' : ''));
        const modules = join(cwd, 'node_modules');
        for (const name of Object.keys(dependencies)) {
          const path = join(modules, name);
          assert.equal(
            realpathSync(path),
            join(realpathSync(modules), name),
            'Workspace link in external consumer',
          );
        }
        const locked = readJson(join(cwd, 'package-lock.json')).packages;
        const manifest = readJson(join(modules, '@ui-lazy-dev/ui-web/package.json'));
        assert.equal(
          Boolean(manifest.exports['./primitives']),
          phase === 'upgrade',
          'Wrong artifact after version change',
        );
        assert.equal(readJson(join(modules, 'react/package.json')).version, pair.react);
        for (const [name, spec] of Object.entries(specs[label]))
          assert.equal(locked['node_modules/' + name]?.resolved, spec);
        for (const name of Object.keys(specs.candidate))
          if (!(name in specs[label])) assert.ok(!locked['node_modules/' + name], 'Unexpected retained archive ' + name);
        await verifyHydration(cwd, browser);
        evidence.push({ phase, version: manifest.version, react: pair.react, hydration: true });
        if (phase === 'upgrade') {
          const bundles = await measureBundles(cwd, pair.label === 'max' ? {} : { selectedEntries: incumbentEntries });
          const families = familyInputs(root);
          checkPackedBudgetAdoption(previousBundleFamilies(root), families, bundles);
          if (pair.label === 'max') {
            saveJson(join(output, 'bundles.json'), bundles);
            saveJson(join(output, 'default-transfer.json'), await measureDefaultTransfer(cwd, browser));
          }
          const javascriptEntries = Object.entries(manifest.exports)
            .filter(([, target]) => typeof target === 'object')
            .map(([entry]) => manifest.name + (entry === '.' ? '' : entry.slice(1)));
          command(cwd, process.execPath, [
            '--input-type=module',
            '-e',
            'await Promise.all(' +
              JSON.stringify(javascriptEntries) +
              '.map(entry => import(entry)));',
          ]);
          const sbom = JSON.parse(
            command(cwd, 'npm', ['sbom', '--sbom-format=cyclonedx', '--omit=dev']),
          );
          const inventory = validateBom(sbom.components);
          for (const component of sbom.components) {
            component.externalReferences = component.externalReferences?.filter(
              (reference) => !reference.url.startsWith('file:'),
            );
          }
          saveJson(join(output, pair.label + '-sbom.json'), sbom);
          saveJson(join(output, pair.label + '-licenses.json'), inventory);
          saveJson(join(cwd, 'package.json'), { ...fixture, dependencies: { ...dependencies, next: pair.next } });
          installLockedConsumer(cwd, 'next-' + pair.label);
          await verifyNext(cwd, browser);
          evidence.at(-1).nextProductionBuildAndHydration = pair.next;
        }
      }
      saveJson(join(output, pair.label + '-compatibility.json'), evidence);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
} finally {
  await browser.close();
}
