import { Transaction } from './transaction.model';

/** A transaction that repeats every month on the same day. */
export interface Recurring {
  id: string;
  description: string;
  amount: number;
  categoryId: string;
  type: Transaction['type'];
  accountId: string;
  /** Day of the month, 1–31; months with fewer days use their last day. */
  dayOfMonth: number;
  /** Last month ('YYYY-MM') a transaction was created for this rule. */
  lastMonth: string;
}
