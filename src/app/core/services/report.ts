import { Category } from '../models/category.model';
import { Transaction } from '../models/transaction.model';

export interface MonthRow {
  /** 'YYYY-MM' */
  month: string;
  income: number;
  expenses: number;
  balance: number;
  /** Share of income left after expenses, as a whole percentage; null without income. */
  savingsRate: number | null;
}

export interface CategoryRow {
  category: Category;
  total: number;
  /** Share of the year's expenses, 0–1. */
  share: number;
  /** Total divided by the months of the year that have any transaction. */
  monthlyAverage: number;
}

export interface YearReport {
  year: number;
  months: MonthRow[];
  totals: Omit<MonthRow, 'month'>;
  expensesByCategory: CategoryRow[];
  largestExpenses: Transaction[];
}

const LARGEST_EXPENSES = 5;

function savingsRate(income: number, expenses: number): number | null {
  return income > 0 ? Math.round(((income - expenses) / income) * 100) : null;
}

/** Years that have transactions, most recent first. */
export function reportYears(transactions: Transaction[]): number[] {
  return [...new Set(transactions.map(t => Number(t.date.slice(0, 4))))].sort((a, b) => b - a);
}

export function yearReport(transactions: Transaction[], categories: Category[], year: number): YearReport {
  const inYear = transactions.filter(t => t.date.startsWith(`${year}-`));

  const months: MonthRow[] = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    const ofMonth = inYear.filter(t => t.date.startsWith(month));
    const income = ofMonth.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = ofMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { month, income, expenses, balance: income - expenses, savingsRate: savingsRate(income, expenses) };
  });

  const income = months.reduce((sum, m) => sum + m.income, 0);
  const expenses = months.reduce((sum, m) => sum + m.expenses, 0);
  const activeMonths = new Set(inYear.map(t => t.date.slice(0, 7))).size;

  const expenseItems = inYear.filter(t => t.type === 'expense');
  const byCategory = new Map<string, number>();
  for (const t of expenseItems) byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
  const unknown: Category = { id: '', name: 'Sin categoría', type: 'expense', color: '#9ca3af' };

  const expensesByCategory = [...byCategory]
    .map(([id, total]) => ({
      category: categories.find(c => c.id === id) ?? { ...unknown, id },
      total,
      share: expenses > 0 ? total / expenses : 0,
      monthlyAverage: activeMonths > 0 ? Math.round(total / activeMonths) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const largestExpenses = [...expenseItems]
    .sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date))
    .slice(0, LARGEST_EXPENSES);

  return {
    year,
    months,
    totals: { income, expenses, balance: income - expenses, savingsRate: savingsRate(income, expenses) },
    expensesByCategory,
    largestExpenses,
  };
}

/** How one year compares with the one before it. Percentages are whole numbers. */
export interface YearComparison {
  previousYear: number;
  income: number | null;
  expenses: number | null;
  balance: number | null;
  /** Difference in savings rate, in percentage points; null when either year has no income. */
  savingsRatePoints: number | null;
  /**
   * Change in each expense category's total, keyed by category id.
   * null means the category had no expenses the year before.
   */
  categories: Record<string, number | null>;
}

/** Percentage change from `previous` to `current`; null when there is nothing to compare against. */
function change(current: number, previous: number): number | null {
  return previous === 0 ? null : Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function compareYears(current: YearReport, previous: YearReport): YearComparison {
  const before = new Map(previous.expensesByCategory.map(row => [row.category.id, row.total]));
  const categories: Record<string, number | null> = {};
  for (const row of current.expensesByCategory) categories[row.category.id] = change(row.total, before.get(row.category.id) ?? 0);

  const rate = current.totals.savingsRate;
  const previousRate = previous.totals.savingsRate;
  return {
    previousYear: previous.year,
    income: change(current.totals.income, previous.totals.income),
    expenses: change(current.totals.expenses, previous.totals.expenses),
    balance: change(current.totals.balance, previous.totals.balance),
    savingsRatePoints: rate === null || previousRate === null ? null : rate - previousRate,
    categories,
  };
}
