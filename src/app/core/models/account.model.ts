/** Where money is kept: a bank account, cash, a card, etc. */
export interface Account {
  id: string;
  name: string;
  /** Balance before the first recorded transaction. */
  initialBalance: number;
}

/** Account every existing transaction moves to; it can be renamed but not deleted. */
export const MAIN_ACCOUNT_ID = 'main';

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: MAIN_ACCOUNT_ID, name: 'Cuenta principal', initialBalance: 0 },
];
