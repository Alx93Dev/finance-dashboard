import { Injectable, computed, inject, signal } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { DEFAULT_CATEGORIES } from '../models/category.model';
import { StorageService } from './storage.service';

const SEED_DATA: Omit<Transaction, 'id'>[] = [
  { description: 'Sueldo enero',       amount: 1200000, categoryId: '1', date: '2025-01-31', type: 'income'  },
  { description: 'Proyecto freelance', amount: 350000,  categoryId: '2', date: '2025-01-15', type: 'income'  },
  { description: 'Supermercado',       amount: 85000,   categoryId: '3', date: '2025-01-10', type: 'expense' },
  { description: 'Uber',               amount: 18000,   categoryId: '4', date: '2025-01-12', type: 'expense' },
  { description: 'Netflix + Spotify',  amount: 22000,   categoryId: '5', date: '2025-01-05', type: 'expense' },
  { description: 'Médico',             amount: 35000,   categoryId: '6', date: '2025-01-20', type: 'expense' },
  { description: 'Arriendo',           amount: 450000,  categoryId: '7', date: '2025-01-01', type: 'expense' },
  { description: 'Varios',             amount: 30000,   categoryId: '8', date: '2025-01-22', type: 'expense' },
];

const STORAGE_KEY = 'transactions';
const SEEDED_KEY  = 'seeded_v3';

function isSampleTransaction(transaction: Transaction): boolean {
  return SEED_DATA.some(seed =>
    seed.description === transaction.description &&
    seed.amount === transaction.amount &&
    seed.categoryId === transaction.categoryId &&
    seed.date === transaction.date &&
    seed.type === transaction.type
  );
}

/** Shifts a 'YYYY-MM' month key by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const shifted = new Date(year, monthIndex - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Percentage change from `previous` to `current`, rounded to a whole number.
 * Returns null when there is nothing to compare against (previous is 0).
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly storage = inject(StorageService);

  readonly transactions = signal<Transaction[]>(
    this.storage.get<Transaction[]>(STORAGE_KEY, [])
  );

  readonly categories = signal(DEFAULT_CATEGORIES);

  readonly totalIncome = computed(() =>
    this.transactions()
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  readonly totalExpenses = computed(() =>
    this.transactions()
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  readonly balance = computed(() => this.totalIncome() - this.totalExpenses());

  /** True while any of the example transactions from the first run are still stored. */
  readonly hasSampleData = computed(() => this.transactions().some(isSampleTransaction));

  /** Month shown on the dashboard, as 'YYYY-MM'. */
  readonly selectedMonth = signal(currentMonth());

  readonly monthTransactions = computed(() => {
    const month = this.selectedMonth();
    return this.transactions().filter(t => t.date.startsWith(month));
  });

  readonly monthIncome = computed(() =>
    this.monthTransactions()
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  readonly monthExpenses = computed(() =>
    this.monthTransactions()
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  readonly monthBalance = computed(() => this.monthIncome() - this.monthExpenses());

  private readonly previousMonthTransactions = computed(() => {
    const month = shiftMonth(this.selectedMonth(), -1);
    return this.transactions().filter(t => t.date.startsWith(month));
  });

  readonly previousMonthIncome = computed(() =>
    this.previousMonthTransactions()
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  readonly previousMonthExpenses = computed(() =>
    this.previousMonthTransactions()
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  readonly previousMonthBalance = computed(() => this.previousMonthIncome() - this.previousMonthExpenses());

  /** Whether the month before the selected one has any transactions to compare against. */
  readonly hasPreviousMonth = computed(() => this.previousMonthTransactions().length > 0);

  constructor() {
    this.initializeSeedData();
    this.selectedMonth.set(this.latestMonth() ?? currentMonth());
  }

  previousMonth(): void {
    this.selectedMonth.update(month => shiftMonth(month, -1));
  }

  nextMonth(): void {
    this.selectedMonth.update(month => shiftMonth(month, 1));
  }

  add(transaction: Omit<Transaction, 'id'>): void {
    const newTransaction: Transaction = { ...transaction, id: crypto.randomUUID() };
    this.transactions.update(current => {
      const updated = [...current, newTransaction];
      this.storage.set(STORAGE_KEY, updated);
      return updated;
    });
  }

  /** Puts back a previously removed transaction, keeping its id. */
  restore(transaction: Transaction): void {
    this.transactions.update(current => {
      if (current.some(t => t.id === transaction.id)) return current;
      const updated = [...current, transaction];
      this.storage.set(STORAGE_KEY, updated);
      return updated;
    });
  }

  /** Removes the example transactions seeded on first run, keeping the user's own. */
  clearSampleData(): void {
    this.transactions.update(current => {
      const updated = current.filter(t => !isSampleTransaction(t));
      this.storage.set(STORAGE_KEY, updated);
      return updated;
    });
  }

  /** Replaces every stored transaction, e.g. when restoring a backup. */
  replaceAll(transactions: Transaction[]): void {
    this.transactions.set(transactions);
    this.storage.set(STORAGE_KEY, transactions);
    this.selectedMonth.set(this.latestMonth() ?? currentMonth());
  }

  remove(id: string): void {
    this.transactions.update(current => {
      const updated = current.filter(t => t.id !== id);
      this.storage.set(STORAGE_KEY, updated);
      return updated;
    });
  }

  update(transaction: Transaction): void {
    this.transactions.update(current => {
      const updated = current.map(t => t.id === transaction.id ? transaction : t);
      this.storage.set(STORAGE_KEY, updated);
      return updated;
    });
  }

  getCategoryById(id: string) {
    return this.categories().find(c => c.id === id);
  }

  /** Most recent month that has transactions, or null when there are none. */
  private latestMonth(): string | null {
    const dates = this.transactions().map(t => t.date);
    if (dates.length === 0) return null;
    return dates.reduce((latest, date) => (date > latest ? date : latest)).slice(0, 7);
  }

  private initializeSeedData(): void {
    if (localStorage.getItem(SEEDED_KEY) === 'true') return;

    const seeded: Transaction[] = SEED_DATA.map(t => ({
      ...t,
      id: crypto.randomUUID(),
    }));

    this.transactions.set(seeded);
    this.storage.set(STORAGE_KEY, seeded);
    localStorage.setItem(SEEDED_KEY, 'true');
  }
}
