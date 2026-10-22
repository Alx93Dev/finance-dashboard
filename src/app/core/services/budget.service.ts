import { Injectable, computed, inject, signal } from '@angular/core';
import { Budget } from '../models/budget.model';
import { Category } from '../models/category.model';
import { StorageService } from './storage.service';
import { TransactionService } from './transaction.service';

const STORAGE_KEY = 'budgets';

/** Share of the budget at which a category is flagged as close to its limit. */
export const WARNING_RATIO = 0.8;

export type BudgetStatus = 'ok' | 'warning' | 'over';

export interface BudgetProgress {
  category: Category;
  limit: number;
  spent: number;
  /** spent / limit; can go above 1. */
  ratio: number;
  status: BudgetStatus;
}

export function budgetStatus(ratio: number): BudgetStatus {
  if (ratio > 1) return 'over';
  if (ratio >= WARNING_RATIO) return 'warning';
  return 'ok';
}

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly storage = inject(StorageService);
  private readonly tx = inject(TransactionService);

  readonly budgets = signal<Budget[]>(this.storage.get<Budget[]>(STORAGE_KEY, []));

  /** Progress of each budgeted category in the selected month, in category order. */
  readonly monthProgress = computed<BudgetProgress[]>(() => {
    const spentByCategory = new Map<string, number>();
    for (const t of this.tx.monthTransactions()) {
      if (t.type !== 'expense') continue;
      spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount);
    }
    const limits = new Map(this.budgets().map(b => [b.categoryId, b.amount]));

    return this.tx.categories()
      .filter(category => limits.has(category.id))
      .map(category => {
        const limit = limits.get(category.id)!;
        const spent = spentByCategory.get(category.id) ?? 0;
        const ratio = spent / limit;
        return { category, limit, spent, ratio, status: budgetStatus(ratio) };
      });
  });

  limitFor(categoryId: string): number | null {
    return this.budgets().find(b => b.categoryId === categoryId)?.amount ?? null;
  }

  /** Sets the monthly limit for a category; a missing or non-positive amount removes it. */
  setLimit(categoryId: string, amount: number | null): void {
    this.budgets.update(current => {
      const others = current.filter(b => b.categoryId !== categoryId);
      const updated = amount && amount > 0 ? [...others, { categoryId, amount }] : others;
      this.storage.set(STORAGE_KEY, updated);
      return updated;
    });
  }

  /** Replaces every stored budget, e.g. when restoring a backup. */
  replaceAll(budgets: Budget[]): void {
    this.budgets.set(budgets);
    this.storage.set(STORAGE_KEY, budgets);
  }
}
