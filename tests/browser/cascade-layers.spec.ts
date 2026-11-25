import { expect, test, type Locator } from '@playwright/test';
import { buildSync } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '@ui-lazy-dev/ui-web';

const css = buildSync({
  stdin: { contents: '@import "@ui-lazy-dev/ui-web/styles.css";', resolveDir: process.cwd(), loader: 'css' },
  bundle: true,
  write: false,
}).outputFiles[0].text;
const markup = renderToStaticMarkup(createElement(Button, { type: 'submit', className: 'partner-action' }, 'Save draft'));
const measure = (control: Locator) => control.evaluate(element => {
  const style = getComputedStyle(element);
  return {
    color: style.color,
    border: style.borderTopWidth,
    minHeight: style.minHeight,
    padding: style.paddingInlineStart,
    boxSizing: style.boxSizing,
  };
});

test('host resets and library controls coexist without changing unrelated buttons', async ({ page }) => {
  await page.setContent(`<style>
    @layer host, uld.reset, uld.tokens, uld.components, uld.utilities;
    @layer host { html body form > button, html body > button {
      border: 0; padding: 0; min-height: 1px; color: rgb(110, 50, 90); box-sizing: content-box;
    } }
  </style><button>Host action</button><form dir="rtl">${markup}</form>`);
  const host = page.getByRole('button', { name: 'Host action' });
  const action = page.getByRole('button', { name: 'Save draft' });
  const previous = await measure(host);
  await page.addStyleTag({ content: css });
  expect(await measure(host)).toEqual(previous);
  const size = await measure(action);
  expect(size.boxSizing).toBe('border-box');
  expect(parseFloat(size.minHeight)).toBeGreaterThanOrEqual(44);
  expect(parseFloat(size.border)).toBeGreaterThanOrEqual(1);
  expect(parseFloat(size.padding)).toBeGreaterThan(0);
  await action.focus();
  await expect(action).toBeFocused();
});

test('an unlayered consumer can override a component with zero selector specificity', async ({ page, browserName }) => {
  await page.setContent(`<style>:where(.partner-action) {
    min-height: 64px; color: rgb(20, 50, 70); padding-inline: 29px;
  }</style><form>${markup}</form><output aria-label="Submission count">0</output>`);
  await page.addStyleTag({ content: css });
  await page.locator('form').evaluate(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const count = document.querySelector('output')!;
    count.value = String(Number(count.value) + 1);
  }));
  const action = page.getByRole('button', { name: 'Save draft' });
  expect(await measure(action)).toMatchObject({ color: 'rgb(20, 50, 70)', minHeight: '64px', padding: '29px' });
  const next = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(next);
  await expect(action).toBeFocused();
  await action.press('Enter');
  await expect(page.getByLabel('Submission count')).toHaveText('1');
});

test('an embedded control isolates hostile host rules and accepts local consumer styles', async ({ page }) => {
  await page.setContent('<style>button { display:none; color:red; }</style><button>Host action</button><section id="embed"></section>');
  await page.locator('#embed').evaluate((host, { css, markup }) => {
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>' + css + '</style><div data-uld-theme="light">' + markup + '</div>';
  }, { css, markup });
  const action = page.getByRole('button', { name: 'Save draft' });
  await expect(action).toBeVisible();
  expect(parseFloat((await measure(action)).minHeight)).toBeGreaterThanOrEqual(44);
  await expect(page.getByText('Host action')).toBeHidden();
  await page.locator('#embed').evaluate(host => {
    const override = document.createElement('style');
    override.textContent = ':where(.partner-action) { padding-inline: 31px; }';
    host.shadowRoot!.append(override);
  });
  expect((await measure(action)).padding).toBe('31px');
});
