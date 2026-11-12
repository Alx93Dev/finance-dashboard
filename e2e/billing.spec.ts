import { expect, test } from '@playwright/test';
import { startEmpty, transactionRow } from './helpers';

test('shows a credit card by billing period and adjusts a closing day', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-25T12:00:00-03:00'));
  await startEmpty(page);

  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  const accounts = page.getByRole('region', { name: 'Cuentas' });
  await accounts.getByRole('button', { name: 'Agregar cuenta' }).click();
  await accounts.getByLabel('Nombre de la cuenta').fill('Tarjeta BCI');
  await accounts.getByLabel('Día de cierre de facturación').fill('19');
  await accounts.getByRole('button', { name: 'Crear cuenta' }).click();

  await page.getByRole('link', { name: 'Go to Transactions' }).click();
  for (const [description, amount, date] of [['Panadería', 2790, '2026-08-20'], ['Comisión', 6962, '2026-09-17'], ['Outlet', 49980, '2026-09-18']] as const) {
    await addTransactionOnCard(description, amount, date);
  }

  async function addTransactionOnCard(description: string, amount: number, date: string) {
    await page.getByRole('button', { name: 'Agregar nueva transacción' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Gasto', exact: true }).click();
    await dialog.getByLabel('Descripción').fill(description);
    await dialog.getByLabel('Monto').fill(String(amount));
    await dialog.getByLabel('Categoría').selectOption({ label: 'Otros' });
    await dialog.getByLabel('Cuenta').selectOption({ label: 'Tarjeta BCI' });
    await dialog.getByLabel('Fecha').fill(date);
    await dialog.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  await page.getByLabel('Filtrar por cuenta').selectOption({ label: 'Tarjeta BCI' });
  await page.getByLabel('Período de facturación').selectOption('2026-09');
  await expect(page.getByLabel('Desde')).toHaveValue('2026-08-20');
  await expect(page.getByLabel('Hasta')).toHaveValue('2026-09-19');
  await expect(page.locator('#period-summary')).toContainText('$59.732');

  // This month the bank closed on the 17th instead.
  await page.getByLabel('Cierre').fill('2026-09-17');
  await expect(page.getByLabel('Hasta')).toHaveValue('2026-09-17');
  await expect(page.locator('#period-summary')).toContainText('$9.752');
  await expect(transactionRow(page, 'Outlet')).toBeHidden();

  await page.getByLabel('Período de facturación').selectOption('2026-10');
  await expect(page.getByLabel('Desde')).toHaveValue('2026-09-18');
  await expect(transactionRow(page, 'Outlet')).toBeVisible();

  await page.reload();
  await page.getByLabel('Filtrar por cuenta').selectOption({ label: 'Tarjeta BCI' });
  await page.getByLabel('Período de facturación').selectOption('2026-09');
  await expect(page.getByLabel('Hasta')).toHaveValue('2026-09-17');
});
