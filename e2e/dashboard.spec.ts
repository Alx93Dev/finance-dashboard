import { expect, test } from '@playwright/test';
import { addTransaction, startEmpty } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-03-20T12:00:00-03:00'));
  await startEmpty(page);
  await addTransaction(page, { type: 'Ingreso', description: 'Sueldo', amount: 1000000, category: 'Sueldo', date: '2026-03-31' });
  await addTransaction(page, { type: 'Gasto', description: 'Arriendo', amount: 400000, category: 'Vivienda', date: '2026-03-01' });
  await addTransaction(page, { type: 'Gasto', description: 'Supermercado', amount: 150000, category: 'Alimentación', date: '2025-12-12' });
});

test('summarises the selected month', async ({ page }) => {
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  const summary = page.getByRole('region', { name: 'Resumen financiero' });
  await expect(page.getByRole('group', { name: 'Seleccionar mes' })).toContainText('marzo 2026');
  await expect(summary).toContainText('$1.000.000');
  await expect(summary).toContainText('$400.000');
  await expect(summary).toContainText('$600.000');

  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Mes anterior' }).click();
  await expect(page.getByRole('group', { name: 'Seleccionar mes' })).toContainText('diciembre 2025');
  await expect(summary).toContainText('$150.000');
});

test('tracks balances and transfers between accounts', async ({ page }) => {
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  const accounts = page.getByRole('region', { name: 'Cuentas' });
  await expect(accounts.getByRole('listitem').filter({ hasText: 'Cuenta principal' })).toContainText('$450.000');

  await accounts.getByRole('button', { name: 'Agregar cuenta' }).click();
  await expect(accounts.getByLabel('Nombre de la cuenta')).toBeFocused();
  await accounts.getByLabel('Nombre de la cuenta').fill('Efectivo');
  await accounts.getByLabel('Saldo inicial').fill('20000');
  await accounts.getByRole('button', { name: 'Crear cuenta' }).click();

  const balance = (name: string) => accounts.getByRole('list', { name: 'Cuentas' }).getByRole('listitem').filter({ hasText: name });
  await expect(balance('Efectivo')).toContainText('$20.000');
  await expect(balance('Total')).toContainText('$470.000');

  await accounts.getByRole('button', { name: 'Transferir' }).click();
  const form = accounts.getByRole('form', { name: 'Nueva transferencia' });
  await form.getByLabel('Desde').selectOption({ label: 'Cuenta principal' });
  await form.getByLabel('Hacia').selectOption({ label: 'Efectivo' });
  await form.getByLabel('Monto').fill('50000');
  await form.getByRole('button', { name: 'Transferir' }).click();

  await expect(balance('Cuenta principal')).toContainText('$400.000');
  await expect(balance('Efectivo')).toContainText('$70.000');
  await expect(balance('Total')).toContainText('$470.000');
});

test('starts new transactions on the chosen main account', async ({ page }) => {
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  const accounts = page.getByRole('region', { name: 'Cuentas' });
  await accounts.getByRole('button', { name: 'Agregar cuenta' }).click();
  await accounts.getByLabel('Nombre de la cuenta').fill('Cuenta Corriente BCI');
  await accounts.getByRole('button', { name: 'Crear cuenta' }).click();

  await accounts.getByRole('button', { name: 'Editar' }).click();
  await accounts.getByLabel('Cuenta principal', { exact: true }).selectOption({ label: 'Cuenta Corriente BCI' });
  await accounts.getByRole('button', { name: 'Guardar' }).click();
  await expect(accounts.getByRole('listitem').filter({ has: page.getByText('Principal', { exact: true }) })).toContainText('Cuenta Corriente BCI');

  await page.getByRole('link', { name: 'Go to Transactions' }).click();
  await page.getByRole('button', { name: 'Agregar nueva transacción' }).click();
  await expect(page.getByRole('dialog').getByLabel('Cuenta').locator('option:checked')).toHaveText('Cuenta Corriente BCI');
});

test('limits the summary to the chosen account', async ({ page }) => {
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  const accounts = page.getByRole('region', { name: 'Cuentas' });
  await accounts.getByRole('button', { name: 'Agregar cuenta' }).click();
  await accounts.getByLabel('Nombre de la cuenta').fill('Tarjeta');
  await accounts.getByRole('button', { name: 'Crear cuenta' }).click();

  const summary = page.getByRole('region', { name: 'Resumen financiero' });
  await expect(summary).toContainText('$1.000.000');
  await page.getByLabel('Cuenta', { exact: true }).selectOption({ label: 'Tarjeta' });
  await expect(summary).not.toContainText('$1.000.000');
  await expect(page.getByText('No hay movimientos en este mes.')).toBeVisible();
  await page.getByLabel('Cuenta', { exact: true }).selectOption({ label: 'Todas las cuentas' });
  await expect(summary).toContainText('$1.000.000');
});

test('shows the yearly report', async ({ page }) => {
  await page.getByRole('link', { name: 'Go to Reports' }).click();
  const years = page.getByRole('group', { name: 'Seleccionar año' });
  await expect(years).toContainText('2026');
  await expect(page.getByRole('row', { name: /^mar/ })).toContainText('$600.000');
  await expect(page.getByRole('region', { name: 'Totales de 2026' })).toContainText('60%');

  await years.getByRole('button', { name: 'Año anterior' }).click();
  await expect(years).toContainText('2025');
  await expect(page.getByRole('row', { name: /^dic/ })).toContainText('$150.000');
  await expect(years.getByRole('button', { name: 'Año anterior' })).toBeDisabled();
});
