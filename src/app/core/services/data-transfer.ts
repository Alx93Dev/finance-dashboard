import { Budget } from '../models/budget.model';
import { Category } from '../models/category.model';
import { Transaction } from '../models/transaction.model';

/** Marks a JSON file as a backup made by this app. */
export const BACKUP_APP_ID = 'finance-dashboard';

export interface Backup {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  transactions: Transaction[];
  /** Missing in backups made before budgets existed (schema version 1). */
  budgets?: Budget[];
}

export interface BackupData {
  transactions: Transaction[];
  /** null when the backup predates budgets, so current budgets are kept. */
  budgets: Budget[] | null;
}

const CSV_HEADER = ['Fecha', 'Descripción', 'Tipo', 'Categoría', 'Monto'];

function csvField(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Transactions as CSV, oldest first, with category names instead of ids. */
export function toCsv(transactions: Transaction[], categories: Category[]): string {
  const names = new Map(categories.map(c => [c.id, c.name]));
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => [
      t.date,
      t.description,
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      names.get(t.categoryId) ?? '',
      t.amount,
    ]);
  return [CSV_HEADER, ...rows].map(row => row.map(csvField).join(',')).join('\r\n');
}

export function toBackup(
  data: { transactions: Transaction[]; budgets: Budget[] },
  schemaVersion: number,
  now = new Date(),
): Backup {
  return { app: BACKUP_APP_ID, schemaVersion, exportedAt: now.toISOString(), ...data };
}

function parseBudget(item: unknown): Budget | null {
  if (!item || typeof item !== 'object') return null;
  const b = item as Record<string, unknown>;
  const amount = Number(b['amount']);
  if (typeof b['categoryId'] !== 'string' || !Number.isFinite(amount) || amount <= 0) return null;
  return { categoryId: b['categoryId'], amount };
}

function parseTransaction(item: unknown): Transaction | null {
  if (!item || typeof item !== 'object') return null;
  const t = item as Record<string, unknown>;
  const amount = Number(t['amount']);
  if (
    typeof t['id'] !== 'string' ||
    typeof t['description'] !== 'string' ||
    typeof t['categoryId'] !== 'string' ||
    typeof t['date'] !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(t['date']) ||
    (t['type'] !== 'income' && t['type'] !== 'expense') ||
    !Number.isFinite(amount)
  ) {
    return null;
  }
  return {
    id: t['id'],
    description: t['description'],
    amount,
    categoryId: t['categoryId'],
    date: t['date'],
    type: t['type'],
  };
}

/**
 * Reads a backup file's text. Throws an Error with a message for the user when
 * the file is not a backup this app can restore.
 */
export function parseBackup(text: string, supportedVersion: number): BackupData {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const backup = data as Partial<Backup> | null;
  if (!backup || backup.app !== BACKUP_APP_ID || !Array.isArray(backup.transactions)) {
    throw new Error('El archivo no es un respaldo de Finance Dashboard.');
  }
  if (typeof backup.schemaVersion === 'number' && backup.schemaVersion > supportedVersion) {
    throw new Error('El respaldo viene de una versión más nueva de la app.');
  }
  const transactions = backup.transactions.map(parseTransaction);
  if (transactions.some(t => t === null)) {
    throw new Error('El respaldo tiene transacciones dañadas.');
  }
  let budgets: Budget[] | null = null;
  if (backup.budgets !== undefined) {
    const parsed = Array.isArray(backup.budgets) ? backup.budgets.map(parseBudget) : [null];
    if (parsed.some(b => b === null)) {
      throw new Error('El respaldo tiene presupuestos dañados.');
    }
    budgets = parsed as Budget[];
  }
  return { transactions: transactions as Transaction[], budgets };
}
