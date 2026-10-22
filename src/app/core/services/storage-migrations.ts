import { Budget } from '../models/budget.model';
import { Transaction } from '../models/transaction.model';

/** Minimal storage surface a migration needs; keeps migrations independent of Angular DI. */
export interface MigrationStorage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
}

export interface Migration {
  /** Schema version the data is at once this migration has run. */
  version: number;
  description: string;
  migrate(storage: MigrationStorage): void;
}

/**
 * Ordered list of schema migrations. To change the stored data shape, append a
 * migration with the next version number; never edit one that has shipped.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Drop malformed transactions and store amounts as numbers',
    migrate(storage) {
      const raw = storage.get<unknown>('transactions', []);
      if (!Array.isArray(raw)) {
        storage.set('transactions', []);
        return;
      }
      const cleaned: Transaction[] = [];
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const t = item as Record<string, unknown>;
        const amount = Number(t['amount']);
        if (
          typeof t['id'] !== 'string' ||
          typeof t['description'] !== 'string' ||
          typeof t['categoryId'] !== 'string' ||
          typeof t['date'] !== 'string' ||
          (t['type'] !== 'income' && t['type'] !== 'expense') ||
          !Number.isFinite(amount)
        ) {
          continue;
        }
        cleaned.push({
          id: t['id'] as string,
          description: t['description'] as string,
          amount,
          categoryId: t['categoryId'] as string,
          date: t['date'] as string,
          type: t['type'] as Transaction['type'],
        });
      }
      storage.set('transactions', cleaned);
    },
  },
  {
    version: 2,
    description: 'Add monthly budgets per category',
    migrate(storage) {
      const raw = storage.get<unknown>('budgets', []);
      const budgets: Budget[] = Array.isArray(raw)
        ? raw.filter((b): b is Budget =>
            !!b && typeof b.categoryId === 'string' && Number.isFinite(b.amount) && b.amount > 0)
        : [];
      storage.set('budgets', budgets);
    },
  },
];
