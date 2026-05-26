export interface Transaction {
  id: string;
  description: string;
  amount: number;
  categoryId: string;
  date: string;
  type: 'income' | 'expense';
}
