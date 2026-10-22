import { TestBed } from '@angular/core/testing';
import { RecurringService, dateInMonth } from './recurring.service';
import { TransactionService } from './transaction.service';

const RENT = { description: 'Arriendo', amount: 450000, categoryId: '7', type: 'expense' as const, accountId: 'main' };

function dates(tx: TransactionService): string[] {
  return tx.transactions().map(t => t.date).sort();
}

describe('dateInMonth', () => {
  it('should clamp the day to the end of short months', () => {
    expect(dateInMonth('2025-01', 31)).toBe('2025-01-31');
    expect(dateInMonth('2025-02', 31)).toBe('2025-02-28');
    expect(dateInMonth('2024-02', 30)).toBe('2024-02-29');
    expect(dateInMonth('2025-04', 5)).toBe('2025-04-05');
  });
});

describe('RecurringService', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('transactions', '[]');
    localStorage.setItem('seeded_v3', 'true');
    TestBed.configureTestingModule({});
  });

  it('should create the missed months up to today, once', () => {
    const recurring = TestBed.inject(RecurringService);
    const tx = TestBed.inject(TransactionService);
    recurring.addFrom({ ...RENT, date: '2025-01-05' });

    expect(recurring.generateDue(new Date(2025, 3, 4))).toBe(2);
    expect(dates(tx)).toEqual(['2025-02-05', '2025-03-05']);

    expect(recurring.generateDue(new Date(2025, 3, 4))).toBe(0);
    expect(recurring.generateDue(new Date(2025, 3, 5))).toBe(1);
    expect(dates(tx)).toEqual(['2025-02-05', '2025-03-05', '2025-04-05']);
    expect(JSON.parse(localStorage.getItem('recurring')!)[0].lastMonth).toBe('2025-04');
  });

  it('should use the last day for rules set on the 31st', () => {
    const recurring = TestBed.inject(RecurringService);
    recurring.addFrom({ ...RENT, date: '2025-01-31' });

    recurring.generateDue(new Date(2025, 2, 31));

    expect(dates(TestBed.inject(TransactionService))).toEqual(['2025-02-28', '2025-03-31']);
  });

  it('should stop creating transactions once removed', () => {
    const recurring = TestBed.inject(RecurringService);
    const rule = recurring.addFrom({ ...RENT, date: '2025-01-05' });
    recurring.remove(rule.id);

    expect(recurring.generateDue(new Date(2025, 5, 1))).toBe(0);
    expect(recurring.rules()).toEqual([]);
  });

  it('should move rules to another category', () => {
    const recurring = TestBed.inject(RecurringService);
    recurring.addFrom({ ...RENT, date: '2025-01-05' });
    recurring.reassignCategory('7', '8');

    expect(recurring.categoryUsage('7')).toBe(0);
    expect(recurring.rules()[0].categoryId).toBe('8');
  });
});
