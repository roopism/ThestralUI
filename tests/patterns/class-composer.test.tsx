import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { classNames } from '../../packages/web/src/_shared/patterns/binding';
import { classes } from '../../packages/web/src/_shared/primitives/binding';

test('pattern components share the class composer and retain caller classes', () => {
  expect(classNames).toBe(classes);
  expect(classes('base')).toBe('base');
  expect(classes('base', 'custom extra')).toBe('base custom extra');
  for (const family of ['documentpreview', 'emptystate', 'panelheader', 'resourcecard']) {
    const source = readFileSync('packages/web/src/' + family + '/binding.tsx', 'utf8');
    expect(source).toContain('../_shared/primitives/binding.js');
  }
});
