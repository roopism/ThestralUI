import { isNativeBinding } from '../binding-entry.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { installedEnvironment, staticProbes } from './runtime-probes.mjs';
import { compare, verifyRuntime, ObservationMismatch } from './api-depth.mjs';
const tools = createRequire(import.meta.url);
function additionalStaticProbes({ doc, h }) {
  const one = (props, selector, read, expected, label) => (subject) => {
    const node = doc(subject, props).querySelector(selector);
    compare(node ? read(node) : null, expected, label);
  };
  const text = (x) => x.textContent;
  return {
    'modes:ModeProvider': one(
      { brand: 'expressive', scheme: 'dark', density: 'compact', motion: 'reduced', mode: 'default',
        children: h('input', { 'aria-label': 'Draft' }) },
      '[data-uld-brand]',
      (node) => [node.dataset.uldBrand, node.dataset.uldScheme, node.dataset.uldDensity,
        node.dataset.uldMotion, node.dataset.uldMode, node.querySelector('input')?.getAttribute('aria-label')],
      ['expressive', 'dark', 'compact', 'reduced', 'default', 'Draft'],
      'All five scoped axes and caller content are present in the server response',
    ),
    'document:Heading': one({ level: 2, children: 'Chapters' }, 'h2', text, 'Chapters', 'Semantic heading level'),
    'document:Separator': one({ orientation: 'vertical' }, 'hr', el => el.getAttribute('aria-orientation'), 'vertical', 'Standalone orientation'),
    'document:Keyboard': one({ children: '⌘P' }, 'kbd', text, '⌘P', 'Standalone shortcut text'),
    'primitives:Box': one(
      { dir: 'rtl', role: 'group', children: 'Content' },
      '[role=group]',
      (e) => [e.dir, text(e)],
      ['rtl', 'Content'],
      'Preserves host semantics, direction and content',
    ),
    'primitives:Surface': one(
      { lang: 'ar', id: 'area', children: h('button', {}, 'Save') },
      '#area',
      (e) => [e.lang, e.querySelector('button')?.textContent],
      ['ar', 'Save'],
      'Surface preserves the supplied host and action',
    ),
    'primitives:Text': one(
      { lang: 'ja', children: '東京' },
      'span',
      (e) => [e.lang, text(e)],
      ['ja', '東京'],
      'Localized text preserves language',
    ),
    'workflows:WorkspacePage': one(
      { title: 'Review', description: 'Check', actions: h('button', {}, 'Save'), children: 'Body' },
      'section',
      (e) => [
        e.querySelector('h1')?.textContent,
        e.querySelector('button')?.textContent,
        e.getAttribute('aria-labelledby') === e.querySelector('h1')?.id,
      ],
      ['Review', 'Save', true],
      'Header actions and region name survive composition',
    ),
  };
}
const sizes = ['sm', 'md', 'lg'];
export const priorityProps = {
  '.:Button': ['size', 'startIcon', 'endIcon', 'busy'],
  'primitives:IconButton': ['size', 'label', 'children'],
  'primitives:Stack': ['gap', 'align', 'justify'],
  'primitives:Inline': ['gap', 'align', 'justify', 'wrap'],
};
export function priorityProbes({ h, markup }, page, css) {
  const display = async (body) => page.setContent('<style>' + css + '</style>' + body);
  const icon = (name) =>
    h('svg', { 'data-icon': name, width: 14, height: 14, role: 'img', 'aria-label': 'Decoration' });
  const geometry = async (elements) =>
    elements.evaluateAll((list) =>
      list.map((node) => {
        const rect = node.getBoundingClientRect();
        return [Math.round(rect.width), Math.round(rect.height)];
      }),
    );
  return {
    '.:Button': async (s) => {
      await display(
        '<form dir="rtl">' +
          sizes
            .map((size) =>
              markup(
                s,
                { size, type: 'submit', startIcon: icon('start'), endIcon: icon('end') },
                'Save',
              ),
            )
            .join('') +
          markup(s, { busy: true }, 'Busy') +
          '</form>',
      );
      const buttons = page.getByRole('button', { name: 'Save', exact: true });
      compare(await buttons.count(), 3, 'Each size remains a named action');
      const viewport = await buttons.evaluateAll((nodes) =>
        nodes.map((button) => {
          const a = button.querySelector('[data-icon=start]'),
            b = button.querySelector('[data-icon=end]');
          return (
            !!a &&
            !!b &&
            !!a.closest('[aria-hidden=true]') &&
            !!b.closest('[aria-hidden=true]') &&
            a.getBoundingClientRect().x > b.getBoundingClientRect().x &&
            button.type === 'submit'
          );
        }),
      );
      compare(
        viewport,
        [true, true, true],
        'Both decorative icons honor logical order; submit keeps native semantics',
      );
      compare(
        new Set((await geometry(buttons)).map((x) => x.join('x'))).size,
        3,
        'Sizes produce three distinct geometries',
      );
      compare(
        await page.getByRole('button', { name: 'Busy' }).isDisabled(),
        true,
        'A busy form action cannot activate',
      );
    },
    'primitives:IconButton': async (s) => {
      await display(
        sizes.map((size) => markup(s, { size, label: 'Dismiss' }, icon('glyph'))).join(''),
      );
      const buttons = page.getByRole('button', { name: 'Dismiss', exact: true });
      compare(await buttons.count(), 3, 'Caller supplies the sole accessible name');
      const boxes = await geometry(buttons);
      compare(
        boxes.every(([w, h]) => w === h) && new Set(boxes.map(([w]) => w)).size === 3,
        true,
        'Three distinct square hit targets',
      );
      compare(
        await buttons.evaluateAll((nodes) =>
          nodes.every(
            (node) => !!node.querySelector('[data-icon=glyph]')?.closest('[aria-hidden=true]'),
          ),
        ),
        true,
        'Each icon renders as a decorative slot',
      );
    },
    'primitives:Stack': async (s) => {
      const panel = (width) =>
        '<div style="container-type:inline-size;width:' +
        width +
        'px">' +
        markup(
          s,
          {
            gap: { base: 'sm', wide: 'lg' },
            align: 'center',
            justify: 'end',
            'data-depth': 'stack',
          },
          h('button', {}, 'One'),
          h('button', {}, 'Two'),
        ) +
        '</div>';
      await display(panel(260) + panel(1000));
      const stacks = page.locator('[data-depth=stack]');
      compare(await stacks.count(), 2, 'Each panel contains its stack');
      const measure = (nodes) =>
        nodes.map((node) => {
          const style = getComputedStyle(node);
          const cross = style.display === 'grid' ? style.justifyItems : style.alignItems;
          const main = style.display === 'grid' ? style.alignContent : style.justifyContent;
          return [
            parseFloat(style.rowGap),
            cross.replace('flex-', ''),
            main.replace('flex-', ''),
            parseFloat(style.getPropertyValue('--uld-space-sm')),
            parseFloat(style.getPropertyValue('--uld-space-lg')),
          ];
        });
      const [small, wide] = await stacks.evaluateAll(measure);
      compare(
        [small[0], wide[0], small[1], wide[2]],
        [small[3], wide[4], 'center', 'end'],
        'Computed alignment and responsive token spacing match independent containers',
      );
      compare(wide[0] > small[0], true, 'Wide spacing exceeds compact spacing');
      await stacks.first().getByRole('button').first().focus();
      await stacks.first().evaluate((node) => (node.parentElement.style.width = '1000px'));
      const [after] = await stacks.evaluateAll(measure);
      compare(after[0], wide[0], 'Container resize recomputes gap');
      compare(
        await stacks.first().evaluate((node) => node.contains(document.activeElement)),
        true,
        'Focus remains inside the same stack',
      );
    },
    'primitives:Inline': async (s) => {
      const row = (wrap, gap, align, justify) =>
        markup(
          s,
          { 'data-depth': 'inline', wrap, gap, align, justify },
          h('button', {}, 'One'),
          h('button', {}, 'Two'),
        );
      await display(row(true, 'sm', 'end', 'space-between') + row(false, 'lg', 'start', 'center'));
      const styles = await page.locator('[data-depth=inline]').evaluateAll((nodes) =>
        nodes.map((node) => {
          const s = getComputedStyle(node);
          return [
            s.flexWrap,
            s.alignItems.replace('flex-', ''),
            s.justifyContent,
            parseFloat(s.columnGap),
            parseFloat(s.getPropertyValue('--uld-space-sm')),
            parseFloat(s.getPropertyValue('--uld-space-lg')),
          ];
        }),
      );
      compare(styles.length, 2, 'Both inline compositions render');
      compare(
        styles.map((x) => x.slice(0, 4)),
        [
          ['wrap', 'end', 'space-between', styles[0][4]],
          ['nowrap', 'start', 'center', styles[1][5]],
        ],
        'Wrap, both axes and token spacing change actual layout',
      );
    },
  };
}
const baselineProps = {
  '.:Button': ['busy', 'type', 'tone'],
  'primitives:IconButton': ['label', 'children', 'tone', 'busy'],
  'primitives:Stack': ['className', 'dir'],
  'primitives:Inline': ['className', 'dir'],
};

function baselineProbes({ doc, h, markup }, page, css) {
  const layout = (display) => async (subject) => {
    await page.setContent(
      '<style>' +
        css +
        '</style>' +
        markup(
          subject,
          { className: 'consumer-layout', role: 'group', dir: 'rtl' },
          h('button', {}, 'Child'),
        ),
    );
    const measurements = await page.getByRole('group').evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node);
        return [
          node.classList.contains('consumer-layout'),
          style.direction,
          style.display,
          parseFloat(style.gap) > 0,
          node.firstElementChild?.textContent,
        ];
      }),
    );
    compare(
      measurements,
      [[true, 'rtl', display, true, 'Child']],
      'Layout preserves direction, content, host classes and default spacing',
    );
  };
  return {
    '.:Button': (subject) => {
      const button = doc(
        subject,
        { type: 'submit', tone: 'secondary', busy: true },
        'Publish',
      ).querySelector('button');
      compare(
        button && [
          button.type,
          button.dataset.tone,
          button.disabled,
          button.getAttribute('aria-disabled'),
          button.getAttribute('aria-busy'),
          button.textContent,
        ],
        // A pending action stays focusable: unavailable to assistive technology, not natively disabled.
        ['submit', 'secondary', false, 'true', 'true', 'Publish'],
        'Pending submit retains semantics, focus and label',
      );
    },
    'primitives:IconButton': (subject) => {
      const button = doc(
        subject,
        { label: 'Help', tone: 'secondary', busy: true },
        h('span', {}, '?'),
      ).querySelector('button');
      compare(
        button && [
          button.getAttribute('aria-label'),
          button.querySelector('[aria-hidden=true]')?.textContent,
          button.dataset.tone,
          button.disabled,
          button.getAttribute('aria-disabled'),
        ],
        ['Help', '?', 'secondary', false, 'true'],
        'Icon action renders its named button and decorative child',
      );
    },
    'primitives:Stack': layout('grid'),
    'primitives:Inline': layout('flex'),
  };
}

export async function validatePacked(consumer, families, actualBindings, target, { scoped = false } = {}) {
  const env = installedEnvironment(consumer);
  // Named JS imports catch declarations pointing to missing runtime re-exports.
  for (const binding of actualBindings.filter((key) => !isNativeBinding(key))) {
    assert.ok(await env.resolveSubject(binding), 'Missing packed JavaScript export ' + binding);
  }
  const { build } = tools('esbuild');
  const css = await build({
    absWorkingDir: resolve(consumer),
    stdin: {
      contents:
        '@import "@ui-lazy-dev/ui-web/styles.css";@import "@ui-lazy-dev/ui-web/primitives.css";',
      resolveDir: resolve(consumer),
      loader: 'css',
    },
    bundle: true,
    write: false,
  });
  const browser = await tools('@playwright/test').chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      isMobile: false,
      hasTouch: false,
    });
    const cssText = css.outputFiles[0].text;
    const probes = {
      ...staticProbes(env),
      ...additionalStaticProbes(env),
      ...baselineProbes(env, page, cssText),
    };
    const enhanced = priorityProbes(env, page, cssText);
    const propsByBinding = { ...baselineProps };
    for (const key of Object.keys(priorityProps)) {
      const action = key === '.:Button' || key === 'primitives:IconButton';
      if (target === 'layout' || (target === 'actions' && action)) {
        const floor = probes[key];
        probes[key] = async (subject) => {
          await floor(subject);
          await enhanced[key](subject);
        };
        propsByBinding[key] = [...new Set([...baselineProps[key], ...priorityProps[key]])];
      }
    }
    const covered = families
      .filter((row) => row.evidence.packed || row.evidence['packed-priority'])
      .map((row) => ({
        id: row.id,
        exports: [row.evidence.packed || row.evidence['packed-priority']],
      }));
    const coveredKeys = new Set(covered.flatMap(row => row.exports));
    const selectedProbes = scoped
      ? Object.fromEntries(Object.entries(probes).filter(([key]) => coveredKeys.has(key)))
      : probes;
    const passed = await verifyRuntime(covered, selectedProbes, env.resolveSubject);
    // Each proposed high-impact feature must also fail when just that single prop becomes inert.
    for (const [key, props] of Object.entries(propsByBinding)) {
      if (scoped && !coveredKeys.has(key)) continue;
      const Subject = await env.resolveSubject(key);
      for (const prop of props) {
        // An icon action always needs a name and a graphic. Make each required input
        // independently inert with a valid, visibly different value.
        const masked = ({ [prop]: ignored, ...retained }) => {
          if (key === 'primitives:IconButton') {
            if (prop === 'label') retained.label = 'Different action';
            if (prop === 'children') retained.children = env.h('span', null, 'Different graphic');
          }
          return env.h(Subject, retained);
        };
        await assert.rejects(
          async () => probes[key](masked),
          ObservationMismatch,
          key + ' must exercise ' + prop,
        );
      }
    }
    return passed;
  } finally {
    await browser.close();
  }
}
