import { Injectable, computed, inject, signal } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { DEFAULT_CATEGORIES } from '../models/category.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private storage = inject(StorageService);

  transactions = signal<Transaction[]>(
    this.storage.get<Transaction[]>('transactions', [])
  );

  categories = signal(DEFAULT_CATEGORIES);

  totalIncome = computed(() =>
    this.transactions()
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  totalExpenses = computed(() =>
    this.transactions()
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  );

  balance = computed(() => this.totalIncome() - this.totalExpenses());

  add(transaction: Omit<Transaction, 'id'>): void {
    const newTransaction: Transaction = {
      ...transaction,
      id: crypto.randomUUID(),
    };
    this.transactions.update(ts => {
      const updated = [...ts, newTransaction];
      this.storage.set('transactions', updated);
      return updated;
    });
  }

  remove(id: string): void {
    this.transactions.update(ts => {
      const updated = ts.filter(t => t.id !== id);
      this.storage.set('transactions', updated);
      return updated;
    });
  }

  getCategoryById(id: string) {
    return this.categories().find(c => c.id === id);
  }

  loadSeedData(): void {
    const seed: Omit<Transaction, 'id'>[] = [
      { description: 'Sueldo enero',     amount: 1200000, categoryId: '1', date: '2025-01-31', type: 'income' },
      { description: 'Proyecto freelance', amount: 350000, categoryId: '2', date: '2025-01-15', type: 'income' },
      { description: 'Supermercado',     amount: 85000,  categoryId: '3', date: '2025-01-10', type: 'expense' },
      { description: 'Uber',             amount: 18000,  categoryId: '4', date: '2025-01-12', type: 'expense' },
      { description: 'Netflix + Spotify', amount: 22000, categoryId: '5', date: '2025-01-05', type: 'expense' },
      { description: 'Médico',           amount: 35000,  categoryId: '6', date: '2025-01-20', type: 'expense' },
      { description: 'Arriendo',         amount: 450000, categoryId: '7', date: '2025-01-01', type: 'expense' },
      { description: 'Varios',           amount: 30000,  categoryId: '8', date: '2025-01-22', type: 'expense' },
    ];
    seed.forEach(t => this.add(t));
  }
}
