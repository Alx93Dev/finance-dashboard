import { TestBed } from '@angular/core/testing';
import { BudgetService, budgetStatus } from './budget.service';
import { TransactionService } from './transaction.service';
import { Transaction } from '../models/transaction.model';

const STORED: Transaction[] = [
  { id: 'a', description: 'Supermercado', amount: 90000,  categoryId: '3', date: '2025-01-10', type: 'expense' },
  { id: 'b', description: 'Feria',        amount: 30000,  categoryId: '3', date: '2025-01-20', type: 'expense' },
  { id: 'c', description: 'Uber',         amount: 18000,  categoryId: '4', date: '2025-01-12', type: 'expense' },
  { id: 'd', description: 'Supermercado', amount: 500000, categoryId: '3', date: '2024-12-10', type: 'expense' },
  { id: 'e', description: 'Sueldo',       amount: 900000, categoryId: '1', date: '2025-01-31', type: 'income'  },
];

describe('budgetStatus', () => {
  it('should flag spending from 80% and above 100%', () => {
    expect(budgetStatus(0.79)).toBe('ok');
    expect(budgetStatus(0.8)).toBe('warning');
    expect(budgetStatus(1)).toBe('warning');
    expect(budgetStatus(1.01)).toBe('over');
  });
});

describe('BudgetService', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('transactions', JSON.stringify(STORED));
    localStorage.setItem('seeded_v3', 'true');
    TestBed.configureTestingModule({});
  });

  it('should start with no budgets', () => {
    expect(TestBed.inject(BudgetService).monthProgress()).toEqual([]);
  });

  it('should sum the selected month expenses of each budgeted category', () => {
    const budgets = TestBed.inject(BudgetService);
    budgets.setLimit('4', 100000);
    budgets.setLimit('3', 100000);

    expect(budgets.monthProgress().map(p => [p.category.name, p.spent, p.status])).toEqual([
      ['Alimentación', 120000, 'over'],
      ['Transporte', 18000, 'ok'],
    ]);

    TestBed.inject(TransactionService).previousMonth();
    expect(budgets.monthProgress()[0].spent).toBe(500000);
  });

  it('should persist limits and remove them when cleared', () => {
    const budgets = TestBed.inject(BudgetService);
    budgets.setLimit('3', 100000);
    budgets.setLimit('3', 150000);
    expect(JSON.parse(localStorage.getItem('budgets')!)).toEqual([{ categoryId: '3', amount: 150000 }]);

    budgets.setLimit('3', null);
    expect(budgets.budgets()).toEqual([]);
    expect(budgets.limitFor('3')).toBeNull();
  });
});
