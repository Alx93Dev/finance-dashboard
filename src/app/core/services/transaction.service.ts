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

  constructor() {
    this.initializeSeedData();
  }

  add(transaction: Omit<Transaction, 'id'>): void {
    const newTransaction: Transaction = { ...transaction, id: crypto.randomUUID() };
    this.transactions.update(current => {
      const updated = [...current, newTransaction];
      this.storage.set(STORAGE_KEY, updated);
      return updated;
    });
  }

  remove(id: string): void {
    this.transactions.update(current => {
      const updated = current.filter(t => t.id !== id);
      this.storage.set(STORAGE_KEY, updated);
      return updated;
    });
  }

  getCategoryById(id: string) {
    return this.categories().find(c => c.id === id);
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
