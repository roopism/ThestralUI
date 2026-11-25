import { expect, test } from '@playwright/test';
import { runWebScenario } from './adapter';
import { mountFixture } from './mount';

const first = { role: 'text', name: 'First' };
const second = { role: 'text', name: 'Second' };

test('decorative copies do not duplicate the accessible target', async ({ page }) => {
  await page.setContent('<p aria-hidden="true">First</p><p>First</p>');
  await runWebScenario(page, { id: 'text.decorative', family: 'Text', fixture: 'duplicate',
    steps: [{ expect: 'visible', target: first }] });
});

test('mixed content retains the reading order of nested and plain text children', async ({ page }) => {
  await page.setContent('<ul><li><div><strong>Accounts</strong><span>Permission denied</span></div></li></ul>');
  await runWebScenario(page, { id: 'batch.read-error', family: 'Batch', fixture: 'error', steps: [
    { expect: 'before', target: { role: 'text', name: 'Accounts' }, other: { role: 'text', name: 'Permission denied' } },
  ] });
});

test('explicit accessibility order takes precedence over markup order', async ({ page, browserName }) => {
  await page.setContent('<main aria-owns="second first"><p id="first">First</p><p id="second">Second</p></main>');
  const operation = runWebScenario(page, { id: 'stack.override', family: 'Stack', fixture: 'owned',
    steps: [{ expect: 'before', target: second, other: first }] });
  if (browserName === 'chromium') await operation;
  else await expect(operation).rejects.toThrow('Cannot verify overridden accessibility order');
});

test('another family can use its accessible web roles and activate its own link', async ({ page }) => {
  await page.setContent('<a href="#orders">View orders</a><h1>Orders</h1>');
  await runWebScenario(page, { id: 'link.orders', family: 'Link', fixture: 'orders', steps: [
    { expect: 'visible', target: { role: 'link', name: 'View orders' } },
    { act: 'activate', target: { role: 'link', name: 'View orders' } },
    { expect: 'visible', target: { role: 'heading', name: 'Orders' } },
  ] });
  await expect(page).toHaveURL(/#orders$/);
});

test('a neutral table matches an interactive grid with selectable rows and grid cells', async ({ page }) => {
  await page.setContent(`
    <table role="grid" aria-label="Team directory">
      <thead><tr><th>Member</th></tr></thead>
      <tbody><tr tabindex="0" aria-selected="false"><td>Nadia Ali</td></tr></tbody>
    </table>
    <output></output>
    <script>
      document.querySelector('tbody tr').onclick = event => {
        event.currentTarget.setAttribute('aria-selected', 'true');
        document.querySelector('output').textContent = 'Selected member: Nadia Ali';
      };
    </script>
  `);
  await runWebScenario(page, { id: 'directory.select', family: 'Directory', fixture: 'team', steps: [
    { expect: 'visible', target: { role: 'table', name: 'Team directory' } },
    { expect: 'visible', target: { role: 'header', name: 'Member' } },
    { expect: 'visible', target: { role: 'cell', name: 'Nadia Ali' } },
    { act: 'activate', target: { role: 'row', name: 'Nadia Ali' } },
    { expect: 'visible', target: { role: 'text', name: 'Selected member: Nadia Ali' } },
  ] });
});

test('mounting Button keeps the optional Stack stylesheet out of the page', async ({ page }) => {
  const styles = () => page.locator('style').allTextContents().then(text => text.join('\n'));
  await mountFixture(page, 'button', 'save-once');
  expect(await styles()).not.toContain('.uld-stack');
  await mountFixture(page, 'stack', 'child-order');
  expect(await styles()).toContain('.uld-stack');
});

test('an unregistered fixture, unknown role or unsupported action fails the scenario', async ({ page }) => {
  await expect(mountFixture(page, 'button', 'missing')).rejects.toThrow('Unknown web fixture button/missing');
  const scenario = { id: 'contracts.unknown', family: 'Contracts', fixture: 'unknown' };
  await expect(runWebScenario(page, { ...scenario, steps: [{ act: 'swipe', target: first }] }))
    .rejects.toThrow('Unsupported web operation swipe');
  await expect(runWebScenario(page, { ...scenario, steps: [{ expect: 'visible', target: { role: 'unknown', name: 'First' } }] }))
    .rejects.toThrow('Unsupported web role unknown');
});

test('activation uses the named semantic control, including a clipped form input', async ({ page }) => {
  await page.setContent(`
    <style>.clipped { position: absolute; clip-path: inset(50%); width: 1px; height: 1px; }</style>
    <input id="other" type="checkbox" aria-label="Email weekly">
    <label for="other">Email</label>
    <input id="email" type="checkbox" class="clipped" aria-label="Email">
    <label for="email">Send Email</label>
    <input type="checkbox" role="switch" aria-label="Night mode">
  `);
  await runWebScenario(page, { id: 'controls.named', family: 'Controls', fixture: 'named', steps: [
    { act: 'activate', target: { role: 'checkbox', name: 'Email' } },
    { act: 'activate', target: { role: 'switch', name: 'Night mode' } },
  ] });
  await expect(page.locator('#email')).toBeChecked();
  await expect(page.locator('#other')).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Night mode' })).toBeChecked();
});

test('activation rejects a disabled checkable form control', async ({ page }) => {
  await page.setContent('<fieldset disabled><label><input type="radio" name="delivery">Evening</label></fieldset>');
  await expect(runWebScenario(page, { id: 'controls.disabled', family: 'Controls', fixture: 'disabled', steps: [
    { act: 'activate', target: { role: 'radio', name: 'Evening' } },
  ] })).rejects.toThrow(/toBeEnabled/);
  await expect(page.getByRole('radio', { name: 'Evening' })).not.toBeChecked();
});

test('two exact checkable targets fail without activating either one', async ({ page }) => {
  await page.setContent('<label><input type="checkbox">Alerts</label><label><input type="checkbox">Alerts</label>');
  await expect(runWebScenario(page, { id: 'controls.duplicate', family: 'Controls', fixture: 'duplicate', steps: [
    { act: 'activate', target: { role: 'checkbox', name: 'Alerts' } },
  ] })).rejects.toThrow(/strict mode violation/);
  await expect(page.locator('input:checked')).toHaveCount(0);
});

test('native and ARIA checkbox states are asserted on the named control', async ({page}) => {
  await page.setContent('<button aria-label="Select one">Decoy</button><label><input id="choice" type="checkbox">Select one</label><div role="checkbox" aria-label="Select page" aria-checked="mixed">Page selection</div>');
  const target = {role:'checkbox', name:'Select one'};
  await runWebScenario(page, {family:'Data table', id:'data-table.checked', fixture:'queue', steps:[
    {expect:'unchecked', target}, {act:'activate',target}, {expect:'checked',target},
    {expect:'mixed',target:{role:'checkbox',name:'Select page'}},
  ]});
  await expect(page.locator('#choice')).toBeChecked();
});
