import { Currency } from './currency.model';

/** Where money is kept: a bank account, cash, a card, etc. */
export interface Account {
  id: string;
  name: string;
  /** Balance before the first recorded transaction, in the account's currency. */
  initialBalance: number;
  /** Currency of the account's balance, transactions and recurring rules. */
  currency: Currency;
}

/**
 * Account created with the app, where transactions from before accounts
 * existed went. It starts as the default account but can be replaced.
 */
export const MAIN_ACCOUNT_ID = 'main';

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: MAIN_ACCOUNT_ID, name: 'Cuenta principal', initialBalance: 0, currency: 'CLP' },
];
