import assert from 'node:assert/strict';
import test from 'node:test';
import { compareWithBase } from './fixtures/protected-inputs.mjs';
import { reviewPolicy } from '../review/qualification-policy.mjs';

const compare = (t, path, before, extra) => compareWithBase(t, path, before, extra, undefined, reviewPolicy);

test('new owner approval lines are refused in ordinary text files', t => {
  for (const path of ['docs/example.md', 'examples/notes.txt']) {
    const original = 'Example notes.\n';
    const changes = compare(t, path, original);
    assert.deepEqual(changes(original + 'The owner will review the example.\n'), []);
    for (const verb of ['authorizes', 'permits']) {
      const line = ['Owner', verb, 'this fictional example.'].join(' ');
      for (const prefix of ['', '   ', '- ', '\t-  ']) {
        assert.ok(changes(original + prefix + line + '\r\n').some(issue => issue.includes('owner approval')), path);
      }
    }
  }
});

test('trusted judge dependencies and hardware profiles are pinned independently of text decisions', t => {
  const path = 'scripts/selection/native-tier-two.mjs';
  const changes = compare(t, path, 'export const version = 1;\n');
  assert.ok(changes('export const version = 2;\n').some(issue => issue.includes('pinned')), path);
  const hardware = compare(t, 'tests/android/profiles.json', '{"sample":"one"}');
  assert.ok(hardware('{"sample":"two"}').some(issue => issue.includes('pinned')));
});

test('assertions retain their enclosing try, function body and loop header', t => {
  const path = 'tests/contract.test.ts';
  const check = 'assert.equal(result, expected);';
  const body = code => "test('sample', () => { " + code + ' });';
  const direct = compare(t, path, body(check));
  assert.deepEqual(direct(body(check + ' assert.ok(ready);')), []);
  for (const scope of [
    'try { ' + check + ' } catch (error) { log(error); }',
    'const verify = () => { ' + check + ' };',
    'function verify() { ' + check + ' }',
    'for (const item of samples) { ' + check + ' }',
  ]) {
    assert.ok(direct(body(scope)).some(issue => issue.includes('assertion context')), scope);
  }
  const loop = expression => body('for (const item of ' + expression + ') { ' + check + ' }');
  const compareLoop = compare(t, path, loop('samples'));
  assert.ok(compareLoop(loop('otherSamples')).some(issue => issue.includes('assertion context')));
  assert.deepEqual(compareLoop(loop('samples').replace(check, check + ' assert.ok(item);')), []);
});

test('anonymous registered commands keep their complete selector and permit additional commands', t => {
  const original = 'appId: example.fixture\n---\n- assertVisible:\n    text: Save\n';
  const compareFlow = compare(t, 'tests/simulator/sample.yaml', original);
  assert.deepEqual(compareFlow(original + '- assertVisible: Done\n'), []);
  assert.ok(compareFlow(original + '    optional: true\n').some(issue => issue.includes('anonymous entry')));
  const compareJSON = compare(t, 'tests/sample.json', '{"cases":[{"check":{"text":"Save"}},{"check":{"text":"Save"}}]}');
  assert.ok(compareJSON('{"cases":[{"check":{"text":"Save"}},{"check":{"text":"Save","optional":true}}]}')
    .some(issue => issue.includes('anonymous entry')));
  const nested = compare(t, 'docs/components/sample.scenarios.yaml', '- match: [Save, Close]\n');
  assert.ok(nested('- match: [Close, Save]\n').some(issue => issue.includes('anonymous entry')));
});

test('the extra pin list includes every repository module imported by either judge', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, resolve, relative } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { default: ts } = await import('typescript');
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const pins = JSON.parse(readFileSync(resolve(root, 'scripts/gates/review/immutable-paths.json')));
  const queue = ['scripts/gates/no-weakening.mjs', 'scripts/gates/review/qualification-policy.mjs'];
  const seen = new Set();
  while (queue.length) {
    const path = queue.pop();
    if (seen.has(path)) continue;
    seen.add(path);
    assert.ok(pins.includes(path), 'Missing immutable judge dependency ' + path);
    const file = resolve(root, path);
    for (const ref of ts.preProcessFile(readFileSync(file, 'utf8'), true, true).importedFiles) {
      if (ref.fileName.startsWith('.')) queue.push(relative(root, resolve(dirname(file), ref.fileName)));
    }
  }
  assert.ok(seen.has('scripts/selection/native-tier-two.mjs'));
  assert.ok(pins.includes('scripts/gates/review/immutable-paths.json'));
});
