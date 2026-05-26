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
}
