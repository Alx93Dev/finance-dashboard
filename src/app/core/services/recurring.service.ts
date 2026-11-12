import { Injectable, inject, signal } from '@angular/core';
import { Recurring, RecurringFrequency } from '../models/recurring.model';
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

/** The date `days` after `date`, both 'YYYY-MM-DD'. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Dates a rule comes due after it last ran, up to `today` ('YYYY-MM-DD'), oldest first.
 * Monthly and yearly rules keep their day of the month; weekly ones their weekday.
 */
export function dueDates(rule: Recurring, today: string): string[] {
  const dates: string[] = [];
  if (rule.frequency === 'weekly') {
    const last = rule.lastDate ?? dateInMonth(rule.lastMonth, rule.dayOfMonth);
    for (let date = addDays(last, 7); date <= today; date = addDays(date, 7)) dates.push(date);
    return dates;
  }
  const step = rule.frequency === 'yearly' ? 12 : 1;
  const currentMonth = today.slice(0, 7);
  for (let month = shiftMonth(rule.lastMonth, step); month <= currentMonth; month = shiftMonth(month, step)) {
    const date = dateInMonth(month, rule.dayOfMonth);
    if (date > today) break;
    dates.push(date);
  }
  return dates;
}

@Injectable({ providedIn: 'root' })
export class RecurringService {
  private readonly storage = inject(StorageService);
  private readonly tx = inject(TransactionService);

  readonly rules = signal<Recurring[]>(this.storage.get<Recurring[]>(STORAGE_KEY, []));

  /**
   * Starts repeating `transaction` every week, month or year. The transaction
   * itself is the first occurrence, so the first copy comes one period later.
   */
  addFrom(transaction: Omit<Transaction, 'id'>, frequency: RecurringFrequency = 'monthly'): Recurring {
    const rule: Recurring = {
      id: crypto.randomUUID(),
      description: transaction.description,
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      type: transaction.type,
      accountId: transaction.accountId,
      dayOfMonth: Number(transaction.date.slice(8, 10)),
      lastMonth: transaction.date.slice(0, 7),
      ...(frequency === 'monthly' ? {} : { frequency }),
      ...(frequency === 'weekly' ? { lastDate: transaction.date } : {}),
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
    const todayDate = dateInMonth(monthOf(today), today.getDate());
    let created = 0;

    const updated = this.rules().map(rule => {
      const dates = dueDates(rule, todayDate);
      for (const date of dates) {
        this.tx.add({
          description: rule.description,
          amount: rule.amount,
          categoryId: rule.categoryId,
          type: rule.type,
          accountId: rule.accountId,
          date,
        });
        created++;
      }
      const last = dates.at(-1);
      if (!last) return rule;
      return { ...rule, lastMonth: last.slice(0, 7), ...(rule.frequency === 'weekly' ? { lastDate: last } : {}) };
    });

    if (created > 0) this.setRules(updated);
    return created;
  }

  private setRules(rules: Recurring[]): void {
    this.rules.set(rules);
    this.storage.set(STORAGE_KEY, rules);
  }
}
