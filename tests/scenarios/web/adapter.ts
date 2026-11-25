import { expect, test, type Page } from '@playwright/test';

type Target = { role: string; name: string };
type Step = { act?: string; expect?: string; target: Target; other?: Target };
export type Scenario = { id: string; family: string; fixture: string; steps: Step[]; webKeyboardFocus?: Target };
type AccessibleNode = string | { role: string; name?: string; text?: string; children?: AccessibleNode[] };

type WebRole = Parameters<Page['getByRole']>[0];
const webRoles: Readonly<Record<string, WebRole>> = {
  button: 'button', link: 'link', heading: 'heading', image: 'img', group: 'group',
  region: 'region', 'text field': 'textbox', 'search field': 'searchbox',
  checkbox: 'checkbox', option: 'option', radio: 'radio', switch: 'switch', slider: 'slider',
  stepper: 'spinbutton', progress: 'progressbar', status: 'status', alert: 'alert',
  dialog: 'dialog', 'alert dialog': 'alertdialog', menu: 'menu', 'menu item': 'menuitem',
  'tab group': 'tablist', tab: 'tab', 'tab panel': 'tabpanel', list: 'list', 'list item': 'listitem',
  table: 'table', row: 'row', header: 'columnheader', cell: 'cell', 'list of choices': 'listbox', 'editable choice': 'combobox',
  tree: 'tree', 'hierarchical grid': 'treegrid', toolbar: 'toolbar', tooltip: 'tooltip',
  form: 'form', separator: 'separator', navigation: 'navigation',
};
// Neutral table roles cover static tables and interactive grids.
const alternativeRole: Partial<Record<WebRole, WebRole>> = {
  table: 'grid', cell: 'gridcell', columnheader: 'rowheader',
};
const activatable = new Set<WebRole>(['button', 'link', 'checkbox', 'option', 'radio', 'row', 'switch', 'tab', 'menuitem']);
function webTarget(target: Target): Target {
  if (target.role === 'text') return target;
  if (!Object.hasOwn(webRoles, target.role)) throw Error('Unsupported web role ' + target.role);
  return { ...target, role: webRoles[target.role] };
}

// A snapshot can fold a single text child into a parent's text field.
// Unfold it before comparing traversal order or detecting duplicates.
function readingOrder(tree: AccessibleNode[]) {
  const result: Target[] = [];
  function visit(node: AccessibleNode) {
    if (typeof node === 'string') {
      result.push({ role: 'text', name: node });
      return;
    }
    if (node.role !== 'text') result.push({ role: node.role, name: node.name ?? '' });
    if (node.text) result.push({ role: 'text', name: node.text });
    for (const child of node.children ?? []) visit(child);
  }
  for (const node of tree) visit(node);
  return result;
}

// Playwright's cross-engine snapshot follows DOM order for some aria-owns
// layouts. Chromium exposes its native accessibility tree for those cases.
// Fail explicitly on other engines instead of certifying the wrong order.
async function accessibleTargets(page: Page, verifyOrder: boolean) {
  if (!verifyOrder || !(await page.locator('[aria-owns]').count()))
    return readingOrder(await page.ariaSnapshotJSON() as AccessibleNode[]);
  if (page.context().browser()?.browserType().name() !== 'chromium')
    throw Error('Cannot verify overridden accessibility order in this browser');
  const session = await page.context().newCDPSession(page);
  try {
    const { nodes } = await session.send('Accessibility.getFullAXTree');
    const byId = new Map(nodes.map(node => [node.nodeId, node]));
    const result: Target[] = [];
    function visit(node: typeof nodes[number]) {
      if (!node.ignored && node.role?.value && node.role.value !== 'InlineTextBox') {
        const role = node.role.value === 'StaticText' ? 'text' : String(node.role.value);
        result.push({ role, name: String(node.name?.value ?? '') });
      }
      for (const id of node.childIds ?? []) visit(byId.get(id)!);
    }
    visit(nodes[0]);
    return result;
  } finally {
    await session.detach();
  }
}

function position(nodes: Target[], target: Target) {
  const alternative = alternativeRole[target.role as WebRole];
  const matching = nodes.flatMap((node, index) =>
    (node.role === target.role || node.role === alternative) && node.name === target.name ? [index] : []);
  expect(matching, 'Unique accessible ' + target.role + ' named ' + target.name).toHaveLength(1);
  return matching[0];
}

function visible(page: Page, target: Target) {
  if (target.role === 'text') {
    // A decorative copy can be visually present too. The tree assertion
    // checks that exactly one accessible match exists.
    return expect(page.getByText(target.name, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  }
  const lookup = (role: WebRole) => page.getByRole(role, { name: target.name, exact: true });
  const role = target.role as WebRole;
  const alternative = alternativeRole[role];
  return expect(alternative ? lookup(role).or(lookup(alternative)) : lookup(role)).toBeVisible();
}

export async function runWebScenario(page: Page, scenario: Scenario) {
  if (scenario.webKeyboardFocus) {
    await test.step(scenario.id + ' keyboard focus', async () => {
      const button = page.getByRole('button', { name: scenario.webKeyboardFocus!.name, exact: true });
      await expect(button).toBeVisible();
      // Safari's default macOS preference uses Option-Tab to visit buttons and links.
      const allControls = process.platform === 'darwin' && page.context().browser()?.browserType().name() === 'webkit';
      await page.keyboard.press(allControls ? 'Alt+Tab' : 'Tab');
      await expect(button).toBeFocused();
      expect(await button.evaluate(node => node.matches(':focus-visible'))).toBe(true);
      await expect(button).toHaveCSS('outline-style', 'solid');
      expect(await button.evaluate(node => parseFloat(getComputedStyle(node).outlineWidth))).toBeGreaterThanOrEqual(2);
    });
  }
  for (const [index, step] of scenario.steps.entries()) {
    await test.step(scenario.id + ' step ' + (index + 1), async () => {
      const target = webTarget(step.target);
      if (step.act === 'activate') {
        const role = target.role as WebRole;
        if (!activatable.has(role)) throw Error('Unsupported activation role ' + step.target.role);
        const control = page.getByRole(role, { name: target.name, exact: true });
        // Styled labels can cover their focusable native input. Space activates that exact control.
        if (role === 'checkbox' || role === 'radio' || role === 'switch') {
          await expect(control).toBeEnabled();
          await control.focus();
          await expect(control).toBeFocused();
          await control.press('Space');
        } else {
          await control.click();
        }
        return;
      }
      if (['checked', 'unchecked', 'mixed'].includes(step.expect ?? '')) {
        const checkbox = page.getByRole('checkbox', { name: target.name, exact: true });
        await expect(checkbox).toBeVisible();
        if (step.expect === 'mixed') await expect(checkbox).toBeChecked({ indeterminate: true });
        else await expect(checkbox).toBeChecked({ checked: step.expect === 'checked' });
        return;
      }
      if (step.expect === 'busy') {
        const button = page.getByRole('button', { name: target.name, exact: true });
        await expect(button).toBeVisible();
        await expect(button).toHaveAttribute('aria-busy', 'true');
        await expect(button).toBeDisabled();
        return;
      }
      if (step.expect !== 'visible' && step.expect !== 'before')
        throw Error('Unsupported web operation ' + (step.act ?? step.expect));
      const other = step.other && webTarget(step.other);
      await visible(page, target);
      if (other) await visible(page, other);
      await expect(async () => {
        const nodes = await accessibleTargets(page, step.expect === 'before');
        const first = position(nodes, target);
        if (step.expect === 'before') expect(first).toBeLessThan(position(nodes, other!));
      }).toPass({ timeout: 3000 });
    });
  }
}
