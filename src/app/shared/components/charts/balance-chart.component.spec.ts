import { balanceTrend } from './balance-chart.component';
import { Transaction } from '../../../core/models/transaction.model';

function t(date: string, amount: number, type: Transaction['type']): Transaction {
  return { id: date + amount, description: '', amount, categoryId: '1', date, type };
}

describe('balanceTrend', () => {
  it('should be empty without transactions', () => {
    expect(balanceTrend([])).toEqual([]);
  });

  it('should accumulate the net of each month in order', () => {
    expect(balanceTrend([
      t('2025-02-10', 300, 'expense'),
      t('2025-01-31', 1000, 'income'),
      t('2025-01-05', 200, 'expense'),
      t('2025-02-28', 500, 'income'),
    ])).toEqual([
      { month: '2025-01', balance: 800 },
      { month: '2025-02', balance: 1000 },
    ]);
  });

  it('should carry the balance through months without movements, across years', () => {
    expect(balanceTrend([
      t('2024-11-01', 100, 'income'),
      t('2025-02-01', 50, 'expense'),
    ])).toEqual([
      { month: '2024-11', balance: 100 },
      { month: '2024-12', balance: 100 },
      { month: '2025-01', balance: 100 },
      { month: '2025-02', balance: 50 },
    ]);
  });
});
