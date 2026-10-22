import { Injectable, inject, signal } from '@angular/core';
import { Recurring } from '../models/recurring.model';
import { Transaction } from '../models/transaction.model';
import { StorageService } from './storage.service';
import { TransactionService, shiftMonth } from './transaction.service';

const STORAGE_KEY = 'recurring';

function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Date ('YYYY-MM-DD') of `day` in `month`, clamped to the month's last day. */
export function dateInMonth(month: string, day: number): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const lastDay = new Date(year, monthIndex, 0).getDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class RecurringService {
  private readonly storage = inject(StorageService);
  private readonly tx = inject(TransactionService);

  readonly rules = signal<Recurring[]>(this.storage.get<Recurring[]>(STORAGE_KEY, []));

  /**
   * Starts repeating `transaction` every month. The transaction itself covers
   * its own month, so the first copy is created the following month.
   */
  addFrom(transaction: Omit<Transaction, 'id'>): Recurring {
    const rule: Recurring = {
      id: crypto.randomUUID(),
      description: transaction.description,
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      type: transaction.type,
      accountId: transaction.accountId,
      dayOfMonth: Number(transaction.date.slice(8, 10)),
      lastMonth: transaction.date.slice(0, 7),
    };
    this.setRules([...this.rules(), rule]);
    return rule;
  }

  remove(id: string): void {
    this.setRules(this.rules().filter(r => r.id !== id));
  }

  /** Number of rules that use a category. */
  categoryUsage(categoryId: string): number {
    return this.rules().filter(r => r.categoryId === categoryId).length;
  }

  /** Points every rule of a category to another one, e.g. before deleting it. */
  reassignCategory(fromId: string, toId: string): void {
    this.setRules(this.rules().map(r => (r.categoryId === fromId ? { ...r, categoryId: toId } : r)));
  }

  /** Points every rule of an account to another one, e.g. before deleting it. */
  reassignAccount(fromId: string, toId: string): void {
    this.setRules(this.rules().map(r => (r.accountId === fromId ? { ...r, accountId: toId } : r)));
  }

  /** Replaces every stored rule, e.g. when restoring a backup. */
  replaceAll(rules: Recurring[]): void {
    this.setRules(rules);
  }

  /**
   * Adds the transactions that came due since each rule last ran, up to
   * `today`. Returns how many were created.
   */
  generateDue(today = new Date()): number {
    const currentMonth = monthOf(today);
    const todayDate = dateInMonth(currentMonth, today.getDate());
    let created = 0;

    const updated = this.rules().map(rule => {
      let lastMonth = rule.lastMonth;
      for (let month = shiftMonth(lastMonth, 1); month <= currentMonth; month = shiftMonth(month, 1)) {
        const date = dateInMonth(month, rule.dayOfMonth);
        if (date > todayDate) break;
        this.tx.add({
          description: rule.description,
          amount: rule.amount,
          categoryId: rule.categoryId,
          type: rule.type,
          accountId: rule.accountId,
          date,
        });
        lastMonth = month;
        created++;
      }
      return lastMonth === rule.lastMonth ? rule : { ...rule, lastMonth };
    });

    if (created > 0) this.setRules(updated);
    return created;
  }

  private setRules(rules: Recurring[]): void {
    this.rules.set(rules);
    this.storage.set(STORAGE_KEY, rules);
  }
}
