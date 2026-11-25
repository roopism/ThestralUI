import { isNativeBinding } from '../binding-entry.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { assertedBehavior, sameObservation, storyProps } from './case-assertions.mjs';
const { families: shipped, revision } = JSON.parse(
  readFileSync(new URL('./families.json', import.meta.url)),
);
export { revision };
export const requiredDepth = 'layout';
export function reviewedFamilies(target = requiredDepth, registrations = shipped) {
  assert.ok(
    ['baseline', 'actions', 'layout'].includes(target),
    'Unknown component depth target ' + target,
  );
  if (target === 'baseline') {
    return registrations.map((row) => {
      if (row.id === 'Button') {
        const native = row.evidence.native[0];
        return {
          ...row,
          evidence: { ...row.evidence, native },
          assertions: { [native]: row.assertions[native] },
        };
      }
      if (row.id === 'Icon button') {
        const { native, ...webEvidence } = row.evidence;
        return {
          ...row,
          exports: row.exports.filter((key) => !isNativeBinding(key)),
          evidence: webEvidence,
          assertions: {},
        };
      }
      return row;
    });
  }
  return registrations.map((row) => {
    const slice = increments[row.id];
    if (!slice || (slice.target === 'layout' && target !== 'layout')) return row;
    return {
      ...row,
      increment: slice,
      evidence: { ...row.evidence, unit: slice.unit[0], browser: slice.browser[0] },
      assertions: {
        ...row.assertions,
        [slice.unit[0]]: slice.unit[1],
        [slice.browser[0]]: slice.browser[1],
      },
    };
  });
}

const buttonBrowser =
  'browser/button-depth.spec.ts | public button sizes retain native form behavior, square targets and logical icon placement';
const layoutUnit =
  'tests/stack-inline.test.tsx | layout token and distribution contracts preserve the host, class and ref';
const increments = {
  Button: {
    target: 'actions',
    spec: 'button',
    story: 'ButtonSizes',
    component: 'Button',
    props: ['size', 'startIcon', 'endIcon', 'tone'],
    unit: [
      'tests/button/controls.test.tsx | decorative start and end icons keep their logical order, including while the action is busy',
      'expect(wrappers).toHaveLength(2)',
    ],
    browser: [buttonBrowser, 'expect(heights[3]).toBeGreaterThan(heights[2])'],
  },
  'Icon button': {
    target: 'actions',
    spec: 'icon-button',
    story: 'ButtonSizes',
    component: 'IconButton',
    props: ['size', 'label', 'tone'],
    unit: [
      'tests/primitives.test.tsx | icon actions are named, suppress duplicate input while busy, and error feedback is announced',
      'expect(click).not.toHaveBeenCalled()',
    ],
    browser: [buttonBrowser, 'expect(icon.width).toBe(icon.height)'],
  },
  Stack: {
    target: 'layout',
    spec: 'stack',
    story: 'StackInline',
    component: 'Stack',
    props: ['gap', 'align'],
    unit: [layoutUnit, 'expect(ref.current).toBe(host)'],
    browser: [
      'browser/stack-inline.spec.ts | Stack and Inline resolve gaps from independent parents and retain focus while resizing',
      "expect(small).toHaveCSS('gap', '24px')",
    ],
  },
  Inline: {
    target: 'layout',
    spec: 'inline',
    story: 'StackInline',
    component: 'Inline',
    props: ['gap', 'align', 'justify', 'wrap'],
    unit: [
      layoutUnit,
      "expect(host.firstElementChild?.firstElementChild).toBe(screen.getByRole('button'))",
    ],
    browser: [
      'browser/stack-inline.spec.ts | logical RTL alignment, wrapping, nested defaults and keyboard order survive tight layouts',
      'expect(b!.y).toBeGreaterThan(a!.y)',
    ],
  },
};

export function verifyExamples(rows, observed, root) {
  let illustratedFamilies = 0;
  let reviewedIncrements = 0;
  for (const row of rows) {
    const inventory = observed.find((entry) => entry.id === row.id);
    assert.ok(inventory, 'Missing inventory family ' + row.id);
    if (inventory.web === 'supported' || inventory.story) {
      const source = readFileSync(join(root, inventory.story), 'utf8');
      assert.ok(/export const /.test(source), 'Missing public story for ' + row.id);
      illustratedFamilies++;
    }
    if (!row.increment) continue;
    const { spec, story, component, props } = row.increment;
    const documentation = readFileSync(join(root, 'docs/components', spec + '.md'), 'utf8');
    assert.ok(
      documentation.split('\n').includes('# ' + row.id) &&
        /https:\/\//.test(documentation),
      'Missing component-specific reference specification for ' + row.id,
    );
    const words = documentation.toLowerCase();
    for (const topic of props)
      assert.ok(
        words.includes(topic.toLowerCase()),
        'Missing ' + component + '.' + topic + ' in its API specification',
      );
    const example = readFileSync(join(root, 'catalog', story + '.stories.tsx'), 'utf8');
    const entry = row.exports.find(
      (key) => key.split(':')[1] === component && !isNativeBinding(key),
    );
    const importedFrom =
      entry.split(':')[0] === '.'
        ? '@ui-lazy-dev/ui-web'
        : '@ui-lazy-dev/ui-web/' + entry.split(':')[0];
    const used = storyProps(example, component, importedFrom);
    for (const prop of props)
      assert.ok(used.has(prop), 'Missing ' + component + '.' + prop + ' in the published story');
    reviewedIncrements++;
  }
  return {
    illustratedFamilies,
    familiesWithoutStory: rows.length - illustratedFamilies,
    reviewedIncrements,
  };
}
export const families = reviewedFamilies();
const kinds = ['unit', 'native', 'browser', 'packed', 'packed-priority'];
export function validateRoutes(rows = families) {
  for (const row of rows) {
    assert.ok((row.expectation ?? row.next)?.trim(), 'Missing explicit family target: ' + row.id);
    const routes = Object.keys(row.evidence ?? {});
    assert.ok(
      routes.some((k) => k !== 'native'),
      'Missing executed behavior route for ' + row.id,
    );
    assert.ok(
      routes.every((k) => kinds.includes(k) && row.evidence[k]?.length),
      'Invalid evidence in ' + row.id,
    );
    const binding = row.evidence.packed || row.evidence['packed-priority'];
    if (binding) assert.ok(row.exports.includes(binding), 'Unrelated packed probe for ' + row.id);
    if (row.exports.some(isNativeBinding))
      assert.ok(row.evidence.native, 'Missing native behavior for ' + row.id);
  }
}
export function verifyPassed(kind, passed, projects = [], rows = families, root = process.cwd()) {
  assert.ok(['unit', 'native', 'browser'].includes(kind), 'Unknown test result kind ' + kind);
  validateRoutes(rows);
  const actual = new Set(passed),
    observations = new Map();
  assert.equal(actual.size, passed.length, 'Duplicate executed cases');
  if (kind === 'browser')
    assert.deepEqual(
      [...projects].sort(),
      ['chromium', 'firefox', 'webkit'],
      'Incomplete engine coverage',
    );
  for (const row of rows) {
    const route = row.evidence[kind];
    if (!route) continue;
    const required = Array.isArray(route) ? route : [route];
    for (const name of required) {
      const names = kind === 'browser' ? projects.map((engine) => engine + ' | ' + name) : [name];
      for (const ref of names)
        assert.ok(actual.has(ref), 'Missing ' + kind + ' behavior for ' + row.id + ': ' + ref);
      const [file, title] = name.split(' | ');
      const path = join(root, kind === 'browser' ? 'tests' : '', file);
      if (!observations.has(path + '|' + title))
        observations.set(
          path + '|' + title,
          assertedBehavior(readFileSync(path, 'utf8'), file, title),
        );
      const requiredAssertion = row.assertions?.[name];
      assert.ok(
        requiredAssertion &&
          observations
            .get(path + '|' + title)
            .some((actual) => sameObservation(actual, requiredAssertion)),
        'Reviewed assertion missing for ' + row.id + ': ' + name,
      );
    }
  }
  return rows.filter((row) => row.evidence[kind]).length;
}

export function verifyCandidatePassed(kind, passed, projects = [], root = process.cwd()) {
  verifyPassed(kind, passed, projects, families, root);
  const candidate = JSON.parse(readFileSync(join(root, 'packages/policy/quality/api-depth/families.json'))).families;
  if (!isDeepStrictEqual(candidate, shipped))
    verifyPassed(kind, passed, projects, reviewedFamilies(requiredDepth, candidate), root);
}
