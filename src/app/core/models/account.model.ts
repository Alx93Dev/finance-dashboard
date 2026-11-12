import { Currency } from './currency.model';

/**
 * When a credit card's statement closes. Each billing period runs from the
 * day after one closing to the next closing, inclusive.
 */
export interface BillingCycle {
  /** Day of the month the statement usually closes, 1 to 31 (the last day in shorter months). */
  closingDay: number;
  /**
   * Actual closing dates as 'YYYY-MM-DD', at most one per month, for months
   * when the bank closed on another day. Sorted oldest first.
   */
  closings?: string[];
}

/** Where money is kept: a bank account, cash, a card, etc. */
export interface Account {
  id: string;
  name: string;
  /** Balance before the first recorded transaction, in the account's currency. */
  initialBalance: number;
  /** Currency of the account's balance, transactions and recurring rules. */
  currency: Currency;
  /** Only for credit cards: lets the account's movements be seen by billing period. */
  billing?: BillingCycle;
}

/**
 * Account created with the app, where transactions from before accounts
 * existed went. It starts as the default account but can be replaced.
 */
export const MAIN_ACCOUNT_ID = 'main';

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: MAIN_ACCOUNT_ID, name: 'Cuenta principal', initialBalance: 0, currency: 'CLP' },
];
