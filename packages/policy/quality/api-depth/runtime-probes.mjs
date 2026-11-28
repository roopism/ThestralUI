import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compare, specifier, verifyRuntime } from './api-depth.mjs';

export function installedEnvironment(root) {
  const require = createRequire(join(resolve(root), 'package.json'));
  const { createElement: h } = require('react');
  const { renderToStaticMarkup: render } = require('react-dom/server');
  const { JSDOM } = require('jsdom');
  const resolveSubject = async (key) => {
    const module = await import(pathToFileURL(require.resolve(specifier(key))).href);
    return module[key.split(':')[1]];
  };
  const markup = (subject, props, ...children) => render(h(subject, props, ...children));
  const doc = (subject, props, ...children) => JSDOM.fragment(markup(subject, props, ...children));
  return { h, markup, doc, resolveSubject };
}

// Short per-binding observations are shared within one process.
// A landmark with the wrong label, a removed association or missing export fails.
export function staticProbes({ doc, h }) {
  const one = (props, selector, read, expected, explanation) => (s) => {
    const element = doc(s, props).querySelector(selector);
    compare(element ? read(element) : null, expected, explanation);
  };
  const content = (node) => node.textContent,
    label = (node) => node.getAttribute('aria-label');
  return {
    'primitives:ScrollArea': one(
      { label: 'Timeline' },
      '[role=region]',
      (e) => [label(e), e.tabIndex],
      ['Timeline', 0],
      'Region remains named and keyboard accessible',
    ),
    'primitives:Icon': one(
      { label: 'Verified', children: '✓' },
      '[role=img]',
      label,
      'Verified',
      'Named pictogram',
    ),
    'primitives:Spinner': one(
      { label: 'Loading records' },
      '[role=status]',
      label,
      'Loading records',
      'Loading announcement',
    ),
    'primitives:Skeleton': one(
      { children: 'Preview' },
      '[aria-hidden=true]',
      content,
      'Preview',
      'Placeholder stays hidden from assistive technology',
    ),
    'primitives:Progress': one(
      { label: 'Backup', max: 9, value: 3 },
      'progress',
      (e) => [label(e), e.value, e.max],
      ['Backup', 3, 9],
      'Named progress reflects the actual value',
    ),
    'primitives:Status': one(
      { tone: 'error', children: 'Offline' },
      '[role=alert]',
      content,
      'Offline',
      'An error creates an alert',
    ),
    'primitives:ButtonGroup': one(
      { label: 'Bulk actions' },
      '[role=group]',
      label,
      'Bulk actions',
      'Related actions form a named group',
    ),
    'avatar:Avatar': one(
      { name: 'Ari Rivers', fallback: 'AR' },
      '[role=img]',
      (e) => [label(e), content(e)],
      ['Ari Rivers', 'AR'],
      'Accessible fallback preserves name',
    ),
    'patterns:EmptyState': one(
      { title: 'No saved filters', headingLevel: 3 },
      'h3',
      content,
      'No saved filters',
      'Caller determines the empty-state heading level',
    ),
    'patterns:DocumentPreview': one(
      { label: 'Report' },
      'section',
      label,
      'Report',
      'Document viewer has the supplied name',
    ),
    'patterns:ResourceCard': one(
      {
        title: 'Report',
        selected: true,
        onSelectedChange: () => {},
        actionLabel: 'Save report',
        actionText: 'Save',
      },
      'article button',
      (e) => [e.getAttribute('aria-pressed'), label(e)],
      ['true', 'Save report'],
      'Selection state and accessible action',
    ),
    '.:FormField': (s) => {
      const tree = doc(s, {
        label: 'Code',
        hint: 'Four digits',
        error: 'Too short',
        children: h('input', { 'aria-describedby': 'external' }),
      });
      const input = tree.querySelector('input');
      compare(input?.getAttribute('aria-invalid'), 'true', 'Invalid field state');
      const descriptions = input.getAttribute('aria-describedby').split(/\s+/);
      compare(descriptions.includes('external'), true, 'Keeps caller descriptions');
      compare(
        descriptions
          .filter((id) => tree.getElementById(id))
          .map((id) => tree.getElementById(id).textContent),
        ['Four digits', 'Too short'],
        'Links help and errors',
      );
    },
    'entry-fields:CodeField': one(
      { label: 'One-time code', digits: 6 },
      'input',
      (e) => [e.maxLength, e.getAttribute('inputmode')],
      [6, 'numeric'],
      'Single six-digit input',
    ),
    'motion:createToastQueue': (s) => {
      const queue = s(2);
      compare(typeof queue?.add, 'function', 'Exposes the queue');
      queue.add({ title: 'One' });
      queue.add({ title: 'Two' });
      queue.add({ title: 'Three' });
      compare(queue.visibleToasts.length, 2, 'Keeps the requested visible cap');
    },
  };
}

// Useful local diagnostic. A subset run cannot attest family completion.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const env = installedEnvironment(process.argv[2]),
    probes = staticProbes(env);
  const subset = Object.keys(probes).map((key) => ({ id: key, exports: [key] }));
  console.log(
    'Verified targeted packed smoke probes:',
    await verifyRuntime(subset, probes, env.resolveSubject),
  );
}
