import { TestBed } from '@angular/core/testing';
import { RecurringService, addDays, dateInMonth, dueDates } from './recurring.service';
import { scheduleLabel } from '../../shared/components/recurring-panel/recurring-panel.component';
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

describe('addDays', () => {
  it('should cross month and year boundaries', () => {
    expect(addDays('2025-01-29', 7)).toBe('2025-02-05');
    expect(addDays('2024-12-30', 7)).toBe('2025-01-06');
    expect(addDays('2025-03-28', 7)).toBe('2025-04-04');
  });
});

describe('dueDates', () => {
  const rule = { id: 'r', ...{ description: 'x', amount: 1, categoryId: '3', type: 'expense' as const, accountId: 'main' } };

  it('should step one month for rules without a frequency', () => {
    expect(dueDates({ ...rule, dayOfMonth: 10, lastMonth: '2025-01' }, '2025-03-09')).toEqual(['2025-02-10']);
  });

  it('should step one week for weekly rules', () => {
    expect(dueDates({ ...rule, frequency: 'weekly', dayOfMonth: 27, lastMonth: '2025-01', lastDate: '2025-01-27' }, '2025-02-17'))
      .toEqual(['2025-02-03', '2025-02-10', '2025-02-17']);
  });

  it('should step one year for yearly rules, clamping 29 February', () => {
    expect(dueDates({ ...rule, frequency: 'yearly', dayOfMonth: 29, lastMonth: '2024-02' }, '2026-03-01'))
      .toEqual(['2025-02-28', '2026-02-28']);
    expect(dueDates({ ...rule, frequency: 'yearly', dayOfMonth: 15, lastMonth: '2025-03' }, '2026-03-14')).toEqual([]);
  });
});

describe('scheduleLabel', () => {
  const rule = { id: 'r', description: 'x', amount: 1, categoryId: '3', type: 'expense' as const, accountId: 'main' };

  it('should describe each frequency in words', () => {
    expect(scheduleLabel({ ...rule, dayOfMonth: 5, lastMonth: '2025-01' })).toBe('día 5 de cada mes');
    expect(scheduleLabel({ ...rule, frequency: 'weekly', dayOfMonth: 27, lastMonth: '2025-01', lastDate: '2025-01-27' })).toBe('cada lunes');
    expect(scheduleLabel({ ...rule, frequency: 'yearly', dayOfMonth: 15, lastMonth: '2025-03' })).toBe('cada año el 15 de marzo');
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

  it('should create weekly copies and remember the last date', () => {
    const recurring = TestBed.inject(RecurringService);
    const tx = TestBed.inject(TransactionService);
    const rule = recurring.addFrom({ ...RENT, description: 'Feria', date: '2025-01-27' }, 'weekly');
    expect(rule).toEqual(expect.objectContaining({ frequency: 'weekly', lastDate: '2025-01-27' }));

    expect(recurring.generateDue(new Date(2025, 1, 12))).toBe(2);
    expect(dates(tx)).toEqual(['2025-02-03', '2025-02-10']);
    expect(recurring.rules()[0]).toEqual(expect.objectContaining({ lastDate: '2025-02-10', lastMonth: '2025-02' }));
  });

  it('should create yearly copies once a year', () => {
    const recurring = TestBed.inject(RecurringService);
    const tx = TestBed.inject(TransactionService);
    recurring.addFrom({ ...RENT, description: 'Permiso de circulación', date: '2024-03-31' }, 'yearly');

    expect(recurring.generateDue(new Date(2025, 2, 30))).toBe(0);
    expect(recurring.generateDue(new Date(2025, 2, 31))).toBe(1);
    expect(dates(tx)).toEqual(['2025-03-31']);
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
