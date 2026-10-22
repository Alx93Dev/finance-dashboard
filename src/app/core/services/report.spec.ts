import { reportYears, yearReport } from './report';
import { DEFAULT_CATEGORIES } from '../models/category.model';
import { Transaction } from '../models/transaction.model';

const t = (id: string, date: string, amount: number, type: Transaction['type'], categoryId: string): Transaction =>
  ({ id, description: id, amount, categoryId, date, type, accountId: 'main' });

const TRANSACTIONS: Transaction[] = [
  t('sueldo-ene', '2025-01-31', 1000000, 'income', '1'),
  t('arriendo-ene', '2025-01-01', 400000, 'expense', '7'),
  t('super-ene', '2025-01-10', 100000, 'expense', '3'),
  t('sueldo-feb', '2025-02-28', 1000000, 'income', '1'),
  t('arriendo-feb', '2025-02-01', 400000, 'expense', '7'),
  t('viaje-mar', '2025-03-15', 300000, 'expense', '8'),
  t('antiguo', '2024-12-20', 50000, 'expense', '3'),
];

describe('reportYears', () => {
  it('should list the years with data, newest first', () => {
    expect(reportYears(TRANSACTIONS)).toEqual([2025, 2024]);
    expect(reportYears([])).toEqual([]);
  });
});

describe('yearReport', () => {
  const report = yearReport(TRANSACTIONS, DEFAULT_CATEGORIES, 2025);

  it('should add up every month of the year', () => {
    expect(report.months).toHaveLength(12);
    expect(report.months[0]).toEqual({ month: '2025-01', income: 1000000, expenses: 500000, balance: 500000, savingsRate: 50 });
    expect(report.months[2]).toEqual({ month: '2025-03', income: 0, expenses: 300000, balance: -300000, savingsRate: null });
    expect(report.months[11]).toEqual({ month: '2025-12', income: 0, expenses: 0, balance: 0, savingsRate: null });
    expect(report.totals).toEqual({ income: 2000000, expenses: 1200000, balance: 800000, savingsRate: 40 });
  });

  it('should rank expense categories with their share and monthly average', () => {
    expect(report.expensesByCategory.map(r => [r.category.name, r.total, r.share, r.monthlyAverage])).toEqual([
      ['Vivienda', 800000, 800000 / 1200000, 266667],
      ['Otros', 300000, 0.25, 100000],
      ['Alimentación', 100000, 100000 / 1200000, 33333],
    ]);
  });

  it('should list the largest expenses of the year only', () => {
    expect(report.largestExpenses.map(e => e.id)).toEqual(['arriendo-feb', 'arriendo-ene', 'viaje-mar', 'super-ene']);
  });

  it('should keep expenses whose category was deleted', () => {
    const orphan = yearReport([t('x', '2025-05-01', 1000, 'expense', 'gone')], DEFAULT_CATEGORIES, 2025);
    expect(orphan.expensesByCategory[0].category.name).toBe('Sin categoría');
  });
});
