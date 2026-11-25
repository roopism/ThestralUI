import { expect, test } from '@playwright/test';
test('recovery interactions keep confidential values out of requests, logs, URLs and persistent storage', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=molecules-account-recovery--recovery&viewMode=story');
  const password = page.getByLabel('New password', { exact: true });
  await expect(password).toBeVisible();
  await page.waitForLoadState('networkidle');
  const secret = 'private-example-' + crypto.randomUUID(),
    code = '509438',
    requests: string[] = [],
    leaks: string[] = [];
  page.on('request', (req) => requests.push(req.method() + ' ' + new URL(req.url()).pathname));
  page.on('console', (msg) => {
    if (msg.text().includes(secret) || msg.text().includes(code)) leaks.push(msg.type());
  });
  page.on('pageerror', (err) => {
    if (err.message.includes(secret) || err.message.includes(code)) leaks.push('pageerror');
  });
  await page.getByLabel('Recovery code').fill(code);
  await password.fill(secret);
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await page.getByRole('button', { name: 'Update access' }).click();
  await expect(page.getByRole('status')).toHaveText('Access updated');
  const persisted = await page.evaluate(() =>
    [
      location.href,
      document.cookie,
      JSON.stringify(localStorage),
      JSON.stringify(sessionStorage),
    ].join('\n'),
  );
  expect(persisted.includes(secret) || persisted.includes(code)).toBe(false);
  expect(leaks).toEqual([]);
  expect(requests).toEqual([]);
});
