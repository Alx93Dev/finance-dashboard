/** Money moved between two of the user's accounts; not income nor an expense. */
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  /** Amount taken out, in the source account's currency. */
  amount: number;
  /** Amount received, when the destination account has another currency. */
  toAmount?: number;
  date: string;
  description: string;
}
