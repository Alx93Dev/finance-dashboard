import { expect, test } from '@playwright/test';
import { startEmpty, transactionRow } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.route('https://mindicador.cl/api', route => route.fulfill({
    json: {
      dolar: { codigo: 'dolar', valor: 950, fecha: '2026-03-20T03:00:00.000Z' },
      uf: { codigo: 'uf', valor: 39000, fecha: '2026-03-20T03:00:00.000Z' },
    },
  }));
  await page.clock.setFixedTime(new Date('2026-03-20T12:00:00-03:00'));
  await startEmpty(page);
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
});

test('keeps a dollar account in dollars and totals in pesos', async ({ page }) => {
  const accounts = page.getByRole('region', { name: 'Cuentas' });
  await accounts.getByRole('button', { name: 'Agregar cuenta' }).click();
  await accounts.getByLabel('Nombre de la cuenta').fill('Freelance USD');
  await accounts.getByLabel('Saldo inicial').fill('100');
  await accounts.getByLabel('Moneda').selectOption('USD');
  await accounts.getByRole('button', { name: 'Crear cuenta' }).click();

  const balance = (name: string) => accounts.getByRole('list', { name: 'Cuentas' }).getByRole('listitem').filter({ hasText: name });
  await expect(balance('Freelance USD')).toContainText('US$100');
  await expect(balance('Freelance USD')).toContainText('≈ $95.000');
  await expect(balance('Total')).toContainText('$95.000');
  await expect(accounts.getByRole('group', { name: 'Tipo de cambio' })).toContainText('Valor de mindicador.cl');

  await page.getByRole('link', { name: 'Go to Transactions' }).click();
  await page.getByRole('button', { name: 'Agregar nueva transacción' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Ingreso', exact: true }).click();
  await dialog.getByLabel('Descripción').fill('Proyecto web');
  await dialog.getByLabel('Cuenta').selectOption({ label: 'Freelance USD' });
  await expect(dialog.getByText('Monto (USD)')).toBeVisible();
  await dialog.getByLabel('Monto (USD)').fill('250.5');
  await dialog.getByLabel('Categoría').selectOption({ label: 'Freelance' });
  await dialog.getByLabel('Fecha').fill('2026-03-18');
  await dialog.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(transactionRow(page, 'Proyecto web')).toContainText('+US$250,5');

  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page.getByRole('region', { name: 'Resumen financiero' })).toContainText('$237.975');
});

test('uses values typed by hand', async ({ page }) => {
  const accounts = page.getByRole('region', { name: 'Cuentas' });
  await accounts.getByRole('button', { name: 'Agregar cuenta' }).click();
  await accounts.getByLabel('Nombre de la cuenta').fill('Depósito UF');
  await accounts.getByLabel('Saldo inicial').fill('2');
  await accounts.getByLabel('Moneda').selectOption('UF');
  await accounts.getByRole('button', { name: 'Crear cuenta' }).click();

  const rates = accounts.getByRole('group', { name: 'Tipo de cambio' });
  await rates.getByRole('button', { name: 'Escribir a mano' }).click();
  await rates.getByLabel('UF en pesos').fill('40000');
  await rates.getByRole('button', { name: 'Guardar valores' }).click();

  await expect(rates).toContainText('Escrito por ti');
  await expect(accounts.getByRole('listitem').filter({ hasText: 'Depósito UF' })).toContainText('≈ $80.000');
  await page.reload();
  await expect(accounts.getByRole('listitem').filter({ hasText: 'Depósito UF' })).toContainText('≈ $80.000');
});
