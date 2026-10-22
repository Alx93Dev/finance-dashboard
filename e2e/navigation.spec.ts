import { expect, test } from '@playwright/test';

test('every page is reachable from the menu', async ({ page }) => {
  await page.goto('/');
  for (const [link, heading] of [
    ['Go to Transactions', 'Transacciones'],
    ['Go to Categories', 'Categorías'],
    ['Go to Reports', 'Reportes'],
    ['Go to Dashboard', 'Resumen'],
  ]) {
    await page.getByRole('link', { name: link }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});

test('unknown routes go back to the dashboard', async ({ page }) => {
  await page.goto('/no-existe');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Resumen' })).toBeVisible();
});

test('the menu fits the screen', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('remembers dark mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Cambiar a modo claro' })).toBeVisible();
});
