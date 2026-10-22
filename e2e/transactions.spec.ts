import { expect, test } from '@playwright/test';
import { addTransaction, startEmpty, transactionRow } from './helpers';

test('first visit shows example data that can be cleared', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Estás viendo datos de ejemplo.')).toBeVisible();
  const summary = page.getByRole('region', { name: 'Resumen financiero' });
  await expect(summary).toContainText('$1.550.000');

  await page.getByRole('button', { name: 'Borrar datos de ejemplo' }).click();
  await expect(page.getByText('Estás viendo datos de ejemplo.')).toBeHidden();
  await expect(page.getByText('Aún no tienes transacciones.')).toBeVisible();
});

test('adds, edits, deletes and restores a transaction', async ({ page }) => {
  await startEmpty(page);
  await addTransaction(page, {
    type: 'Gasto',
    description: 'Feria',
    amount: 25000,
    category: 'Alimentación',
    date: '2026-03-14',
  });

  const row = transactionRow(page, 'Feria');
  await expect(row).toContainText('-$25.000');
  await expect(row).toContainText('Alimentación · 14 mar 2026');

  await row.getByRole('button', { name: 'Editar Feria' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Editar transacción' })).toBeVisible();
  await dialog.getByLabel('Monto').fill('27500');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(row).toContainText('-$27.500');

  await row.getByRole('button', { name: 'Eliminar Feria' }).click();
  await expect(row).toBeHidden();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(row).toContainText('-$27.500');
});

test('the form does not submit without the required fields', async ({ page }) => {
  await startEmpty(page);
  await page.getByRole('button', { name: 'Agregar nueva transacción' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Agregar', exact: true })).toBeDisabled();
  await dialog.getByLabel('Descripción').fill('Algo');
  await dialog.getByLabel('Descripción').fill('');
  await dialog.getByLabel('Monto').focus();
  await expect(dialog.getByText('La descripción es requerida')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar formulario' }).click();
  await expect(dialog).toBeHidden();
});

test('filters by type, text and date', async ({ page }) => {
  await startEmpty(page);
  await addTransaction(page, { type: 'Ingreso', description: 'Sueldo marzo', amount: 900000, category: 'Sueldo', date: '2026-03-31' });
  await addTransaction(page, { type: 'Gasto', description: 'Bencina', amount: 40000, category: 'Transporte', date: '2026-03-05' });
  await addTransaction(page, { type: 'Gasto', description: 'Cine', amount: 12000, category: 'Entretenimiento', date: '2026-02-20' });

  const list = page.getByRole('region', { name: 'Lista de transacciones' }).getByRole('listitem');
  await expect(list).toHaveCount(3);

  await page.getByRole('button', { name: 'Gastos', exact: true }).click();
  await expect(list).toHaveCount(2);
  await page.getByRole('button', { name: 'Todos', exact: true }).click();

  await page.getByRole('searchbox', { name: 'Buscar transacciones' }).fill('cine');
  await expect(list).toHaveCount(1);
  await expect(transactionRow(page, 'Cine')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar transacciones' }).fill('');

  await page.getByLabel('Desde').fill('2026-03-01');
  await expect(list).toHaveCount(2);
  await expect(transactionRow(page, 'Cine')).toBeHidden();
});

test('keeps transactions after a reload', async ({ page }) => {
  await startEmpty(page);
  await addTransaction(page, { type: 'Gasto', description: 'Farmacia', amount: 8990, category: 'Salud', date: '2026-04-02' });
  await page.reload();
  await expect(transactionRow(page, 'Farmacia')).toContainText('-$8.990');
  await expect(page.getByText('Estás viendo datos de ejemplo.')).toBeHidden();
});
