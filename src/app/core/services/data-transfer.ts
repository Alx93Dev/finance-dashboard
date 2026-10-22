import { Account, DEFAULT_ACCOUNTS, MAIN_ACCOUNT_ID } from '../models/account.model';
import { Budget } from '../models/budget.model';
import { Recurring } from '../models/recurring.model';
import { Category } from '../models/category.model';
import { Goal } from '../models/goal.model';
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
  /** Missing in backups made before categories were editable (schema version 2 or older). */
  categories?: Category[];
  /** Missing in backups made before recurring transactions (schema version 3 or older). */
  recurring?: Recurring[];
  /** Missing in backups made before savings goals (schema version 4 or older). */
  goals?: Goal[];
  /** Missing in backups made before accounts (schema version 5 or older). */
  accounts?: Account[];
}

export interface BackupData {
  transactions: Transaction[];
  /** null when the backup predates budgets, so current budgets are kept. */
  budgets: Budget[] | null;
  /** null when the backup predates editable categories, so current ones are kept. */
  categories: Category[] | null;
  /** null when the backup predates recurring transactions, so current rules are kept. */
  recurring: Recurring[] | null;
  /** null when the backup predates savings goals, so current goals are kept. */
  goals: Goal[] | null;
  /** null when the backup predates accounts; its transactions then belong to the main account. */
  accounts: Account[] | null;
}

const CSV_HEADER = ['Fecha', 'Descripción', 'Tipo', 'Categoría', 'Cuenta', 'Monto'];

function csvField(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Transactions as CSV, oldest first, with category and account names instead of ids. */
export function toCsv(transactions: Transaction[], categories: Category[], accounts: Account[] = DEFAULT_ACCOUNTS): string {
  const names = new Map(categories.map(c => [c.id, c.name]));
  const accountNames = new Map(accounts.map(a => [a.id, a.name]));
  const rows = [...transactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(t => [
      t.date,
      t.description,
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      names.get(t.categoryId) ?? '',
      accountNames.get(t.accountId) ?? '',
      t.amount,
    ]);
  return [CSV_HEADER, ...rows].map(row => row.map(csvField).join(',')).join('\r\n');
}

export function toBackup(
  data: { transactions: Transaction[]; budgets: Budget[]; categories: Category[]; recurring: Recurring[]; goals: Goal[]; accounts: Account[] },
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

function parseCategory(item: unknown): Category | null {
  if (!item || typeof item !== 'object') return null;
  const c = item as Record<string, unknown>;
  if (
    typeof c['id'] !== 'string' ||
    typeof c['name'] !== 'string' ||
    typeof c['color'] !== 'string' ||
    (c['type'] !== 'income' && c['type'] !== 'expense')
  ) {
    return null;
  }
  return { id: c['id'], name: c['name'], color: c['color'], type: c['type'] };
}

function parseRecurring(item: unknown): Recurring | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  const amount = Number(r['amount']);
  const day = Number(r['dayOfMonth']);
  if (
    typeof r['id'] !== 'string' ||
    typeof r['description'] !== 'string' ||
    typeof r['categoryId'] !== 'string' ||
    (r['type'] !== 'income' && r['type'] !== 'expense') ||
    !Number.isFinite(amount) ||
    !Number.isInteger(day) || day < 1 || day > 31 ||
    typeof r['lastMonth'] !== 'string' || !/^\d{4}-\d{2}$/.test(r['lastMonth'])
  ) {
    return null;
  }
  return {
    id: r['id'],
    description: r['description'],
    amount,
    categoryId: r['categoryId'],
    type: r['type'],
    accountId: typeof r['accountId'] === 'string' ? r['accountId'] : MAIN_ACCOUNT_ID,
    dayOfMonth: day,
    lastMonth: r['lastMonth'],
  };
}

function parseGoal(item: unknown): Goal | null {
  if (!item || typeof item !== 'object') return null;
  const g = item as Record<string, unknown>;
  const target = Number(g['target']);
  const saved = Number(g['saved']);
  const deadline = g['deadline'] ?? null;
  if (
    typeof g['id'] !== 'string' ||
    typeof g['name'] !== 'string' ||
    !Number.isFinite(target) || target <= 0 ||
    !Number.isFinite(saved) || saved < 0 ||
    (deadline !== null && (typeof deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)))
  ) {
    return null;
  }
  return { id: g['id'], name: g['name'], target, saved, deadline: deadline as string | null };
}

function parseAccount(item: unknown): Account | null {
  if (!item || typeof item !== 'object') return null;
  const a = item as Record<string, unknown>;
  const initialBalance = Number(a['initialBalance']);
  if (typeof a['id'] !== 'string' || typeof a['name'] !== 'string' || !Number.isFinite(initialBalance)) return null;
  return { id: a['id'], name: a['name'], initialBalance };
}

/** Parses an optional list of the backup; undefined means the backup predates it. */
function parseOptionalList<T>(value: unknown, parse: (item: unknown) => T | null, error: string): T[] | null {
  if (value === undefined) return null;
  const parsed = Array.isArray(value) ? value.map(parse) : [null];
  if (parsed.some(item => item === null)) throw new Error(error);
  return parsed as T[];
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
    accountId: typeof t['accountId'] === 'string' ? t['accountId'] : MAIN_ACCOUNT_ID,
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
  const budgets = parseOptionalList(backup.budgets, parseBudget, 'El respaldo tiene presupuestos dañados.');
  const categories = parseOptionalList(backup.categories, parseCategory, 'El respaldo tiene categorías dañadas.');
  const recurring = parseOptionalList(backup.recurring, parseRecurring, 'El respaldo tiene recurrentes dañadas.');
  const goals = parseOptionalList(backup.goals, parseGoal, 'El respaldo tiene metas dañadas.');
  let accounts = parseOptionalList(backup.accounts, parseAccount, 'El respaldo tiene cuentas dañadas.');
  if (accounts && !accounts.some(a => a.id === MAIN_ACCOUNT_ID)) accounts = [...DEFAULT_ACCOUNTS, ...accounts];

  // Anything pointing to an account the backup doesn't have goes to the main account.
  const accountIds = new Set((accounts ?? DEFAULT_ACCOUNTS).map(a => a.id));
  const inKnownAccount = <T extends { accountId: string }>(item: T): T =>
    accountIds.has(item.accountId) ? item : { ...item, accountId: MAIN_ACCOUNT_ID };
  return {
    transactions: (transactions as Transaction[]).map(inKnownAccount),
    budgets,
    categories,
    recurring: recurring?.map(inKnownAccount) ?? null,
    goals,
    accounts,
  };
}
