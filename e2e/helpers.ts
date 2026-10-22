import { expect, Page } from '@playwright/test';

export interface NewTransaction {
  type: 'Ingreso' | 'Gasto';
  description: string;
  amount: number;
  category: string;
  date: string;
}

/** Opens the app on the transactions page with the example data removed. */
export async function startEmpty(page: Page): Promise<void> {
  await page.goto('/transactions');
  await page.getByRole('button', { name: 'Borrar datos de ejemplo' }).click();
  await expect(page.getByText('Aún no tienes transacciones.')).toBeVisible();
}

/** Adds a transaction through the form on the transactions page. */
export async function addTransaction(page: Page, transaction: NewTransaction): Promise<void> {
  await page.getByRole('button', { name: 'Agregar nueva transacción' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: transaction.type, exact: true }).click();
  await dialog.getByLabel('Descripción').fill(transaction.description);
  await dialog.getByLabel('Monto').fill(String(transaction.amount));
  await dialog.getByLabel('Categoría').selectOption({ label: transaction.category });
  await dialog.getByLabel('Fecha').fill(transaction.date);
  await dialog.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(dialog).toBeHidden();
}

export function transactionRow(page: Page, description: string) {
  return page
    .getByRole('region', { name: 'Lista de transacciones' })
    .getByRole('listitem')
    .filter({ has: page.getByText(description, { exact: true }) });
}
