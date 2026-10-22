import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { addTransaction, startEmpty, transactionRow } from './helpers';

test('downloads a backup and restores it', async ({ page }) => {
  await startEmpty(page);
  await addTransaction(page, { type: 'Gasto', description: 'Gimnasio', amount: 29990, category: 'Salud', date: '2026-05-03' });

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar respaldo' }).click();
  const backup = await downloading;
  const path = await backup.path();
  const content = JSON.parse(await readFile(path, 'utf8'));
  expect(content.transactions).toHaveLength(1);

  await page.getByRole('button', { name: 'Eliminar Gimnasio' }).click();
  await expect(page.getByText('Aún no tienes transacciones.')).toBeVisible();

  await page.locator('input[type="file"][accept^=".json"]').setInputFiles(path);
  await page.getByRole('button', { name: 'Reemplazar' }).click();
  await expect(page.getByRole('region', { name: 'Tus datos' }).getByRole('status')).toContainText('Se restauraron');
  await expect(transactionRow(page, 'Gimnasio')).toContainText('-$29.990');
});

test('exports transactions as CSV', async ({ page }) => {
  await startEmpty(page);
  await addTransaction(page, { type: 'Ingreso', description: 'Bono', amount: 100000, category: 'Sueldo', date: '2026-06-30' });

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const csv = await readFile(await (await downloading).path(), 'utf8');
  expect(csv).toContain('Bono');
  expect(csv).toContain('Cuenta');
});
