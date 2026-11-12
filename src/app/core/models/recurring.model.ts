import { Transaction } from './transaction.model';

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

/** A transaction that repeats every week, month or year. */
export interface Recurring {
  id: string;
  description: string;
  amount: number;
  categoryId: string;
  type: Transaction['type'];
  accountId: string;
  /** Missing in rules made before frequencies existed, which are monthly. */
  frequency?: RecurringFrequency;
  /** Day of the month, 1–31; months with fewer days use their last day. Unused by weekly rules. */
  dayOfMonth: number;
  /** Last month ('YYYY-MM') a transaction was created for this rule. */
  lastMonth: string;
  /** Weekly rules only: date ('YYYY-MM-DD') of the last transaction created. */
  lastDate?: string;
}
