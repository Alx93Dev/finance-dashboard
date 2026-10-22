/** Money moved between two of the user's accounts; not income nor an expense. */
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  description: string;
}
