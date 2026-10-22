import { TestBed } from '@angular/core/testing';
import { Transaction } from '../models/transaction.model';
import { TransactionService, percentChange, shiftMonth } from './transaction.service';

const STORAGE_KEY = 'transactions';
const SEEDED_KEY = 'seeded_v3';

function stored(): Transaction[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
}

function createService(): TransactionService {
  return TestBed.inject(TransactionService);
}

describe('TransactionService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  describe('seed data', () => {
    it('should seed transactions on first run and persist them', () => {
      const service = createService();

      expect(service.transactions().length).toBe(8);
      expect(stored()).toEqual(service.transactions());
      expect(localStorage.getItem(SEEDED_KEY)).toBe('true');
    });

    it('should not reseed once seeded', () => {
      localStorage.setItem(SEEDED_KEY, 'true');
      const service = createService();

      expect(service.transactions()).toEqual([]);
    });

    it('should load existing transactions from localStorage', () => {
      const existing: Transaction[] = [
        { id: 'a', description: 'Café', amount: 3000, categoryId: '3', date: '2025-02-01', type: 'expense' },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      localStorage.setItem(SEEDED_KEY, 'true');

      const service = createService();

      expect(service.transactions()).toEqual(existing);
    });
  });

  describe('with an empty store', () => {
    let service: TransactionService;

    beforeEach(() => {
      localStorage.setItem(SEEDED_KEY, 'true');
      service = createService();
    });

    it('should add a transaction with a generated id and persist it', () => {
      service.add({ description: 'Sueldo', amount: 1000, categoryId: '1', date: '2025-02-28', type: 'income' });

      const [added] = service.transactions();
      expect(service.transactions().length).toBe(1);
      expect(added.id).toBeTruthy();
      expect(added.description).toBe('Sueldo');
      expect(stored()).toEqual(service.transactions());
    });

    it('should give each added transaction a unique id', () => {
      service.add({ description: 'A', amount: 1, categoryId: '8', date: '2025-02-01', type: 'expense' });
      service.add({ description: 'B', amount: 2, categoryId: '8', date: '2025-02-02', type: 'expense' });

      const [a, b] = service.transactions();
      expect(a.id).not.toBe(b.id);
    });

    it('should update an existing transaction and persist it', () => {
      service.add({ description: 'Uber', amount: 5000, categoryId: '4', date: '2025-02-03', type: 'expense' });
      const original = service.transactions()[0];

      service.update({ ...original, description: 'Metro', amount: 800 });

      expect(service.transactions()).toEqual([{ ...original, description: 'Metro', amount: 800 }]);
      expect(stored()).toEqual(service.transactions());
    });

    it('should leave transactions unchanged when updating an unknown id', () => {
      service.add({ description: 'Uber', amount: 5000, categoryId: '4', date: '2025-02-03', type: 'expense' });
      const before = service.transactions();

      service.update({ ...before[0], id: 'missing', description: 'Metro' });

      expect(service.transactions()).toEqual(before);
    });

    it('should remove a transaction and persist the removal', () => {
      service.add({ description: 'A', amount: 1, categoryId: '8', date: '2025-02-01', type: 'expense' });
      service.add({ description: 'B', amount: 2, categoryId: '8', date: '2025-02-02', type: 'expense' });
      const [a, b] = service.transactions();

      service.remove(a.id);

      expect(service.transactions()).toEqual([b]);
      expect(stored()).toEqual([b]);
    });

    it('should restore a removed transaction with its original id', () => {
      service.add({ description: 'A', amount: 1, categoryId: '8', date: '2025-02-01', type: 'expense' });
      const [a] = service.transactions();
      service.remove(a.id);

      service.restore(a);

      expect(service.transactions()).toEqual([a]);
      expect(stored()).toEqual([a]);
    });

    it('should not duplicate a transaction that is already present', () => {
      service.add({ description: 'A', amount: 1, categoryId: '8', date: '2025-02-01', type: 'expense' });
      const [a] = service.transactions();

      service.restore(a);

      expect(service.transactions()).toEqual([a]);
    });

    it('should compute totals and balance', () => {
      service.add({ description: 'Sueldo', amount: 1000, categoryId: '1', date: '2025-02-28', type: 'income' });
      service.add({ description: 'Freelance', amount: 500, categoryId: '2', date: '2025-02-15', type: 'income' });
      service.add({ description: 'Arriendo', amount: 400, categoryId: '7', date: '2025-02-01', type: 'expense' });

      expect(service.totalIncome()).toBe(1500);
      expect(service.totalExpenses()).toBe(400);
      expect(service.balance()).toBe(1100);

      service.remove(service.transactions()[2].id);
      expect(service.totalExpenses()).toBe(0);
      expect(service.balance()).toBe(1500);
    });

    it('should restore persisted changes in a new service instance', () => {
      service.add({ description: 'Netflix', amount: 9000, categoryId: '5', date: '2025-02-05', type: 'expense' });
      const saved = service.transactions();

      TestBed.resetTestingModule();
      const reloaded = createService();

      expect(reloaded.transactions()).toEqual(saved);
    });
  });

  describe('sample data', () => {
    it('should report sample data after the first run', () => {
      expect(createService().hasSampleData()).toBe(true);
    });

    it('should clear the sample data but keep the user\'s own transactions', () => {
      const service = createService();
      service.add({ description: 'Café', amount: 3000, categoryId: '3', date: '2025-02-01', type: 'expense' });

      service.clearSampleData();

      expect(service.hasSampleData()).toBe(false);
      expect(service.transactions().map(t => t.description)).toEqual(['Café']);
      expect(stored()).toEqual(service.transactions());
    });

    it('should not treat an edited example as sample data', () => {
      const service = createService();
      const [first] = service.transactions();
      service.update({ ...first, amount: first.amount + 1 });

      service.clearSampleData();

      expect(service.transactions()).toEqual([{ ...first, amount: first.amount + 1 }]);
    });
  });

  describe('month selection', () => {
    it('should start on the most recent month with transactions', () => {
      const existing: Transaction[] = [
        { id: 'a', description: 'Café',  amount: 3000, categoryId: '3', date: '2025-02-01', type: 'expense' },
        { id: 'b', description: 'Metro', amount: 800,  categoryId: '4', date: '2025-04-12', type: 'expense' },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      localStorage.setItem(SEEDED_KEY, 'true');

      expect(createService().selectedMonth()).toBe('2025-04');
    });

    it('should start on the seed data month on first run', () => {
      expect(createService().selectedMonth()).toBe('2025-01');
    });

    it('should start on the current month when there are no transactions', () => {
      localStorage.setItem(SEEDED_KEY, 'true');
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      expect(createService().selectedMonth()).toBe(expected);
    });

    it('should compute totals for the selected month only', () => {
      localStorage.setItem(SEEDED_KEY, 'true');
      const service = createService();
      service.add({ description: 'Sueldo',   amount: 1000, categoryId: '1', date: '2025-02-28', type: 'income'  });
      service.add({ description: 'Arriendo', amount: 400,  categoryId: '7', date: '2025-02-01', type: 'expense' });
      service.add({ description: 'Sueldo',   amount: 1200, categoryId: '1', date: '2025-03-31', type: 'income'  });

      service.selectedMonth.set('2025-02');
      expect(service.monthTransactions().length).toBe(2);
      expect(service.monthIncome()).toBe(1000);
      expect(service.monthExpenses()).toBe(400);
      expect(service.monthBalance()).toBe(600);

      service.nextMonth();
      expect(service.selectedMonth()).toBe('2025-03');
      expect(service.monthIncome()).toBe(1200);
      expect(service.monthExpenses()).toBe(0);

      service.nextMonth();
      expect(service.monthTransactions()).toEqual([]);
      expect(service.monthBalance()).toBe(0);
    });

    it('should move between months across year boundaries', () => {
      const service = createService();
      service.selectedMonth.set('2025-01');

      service.previousMonth();
      expect(service.selectedMonth()).toBe('2024-12');

      service.nextMonth();
      service.nextMonth();
      expect(service.selectedMonth()).toBe('2025-02');
    });

    it('should compute the previous month totals', () => {
      localStorage.setItem(SEEDED_KEY, 'true');
      const service = createService();
      service.add({ description: 'Sueldo',   amount: 1000, categoryId: '1', date: '2025-01-31', type: 'income'  });
      service.add({ description: 'Arriendo', amount: 400,  categoryId: '7', date: '2025-01-01', type: 'expense' });
      service.add({ description: 'Sueldo',   amount: 1200, categoryId: '1', date: '2025-02-28', type: 'income'  });

      service.selectedMonth.set('2025-02');
      expect(service.hasPreviousMonth()).toBe(true);
      expect(service.previousMonthIncome()).toBe(1000);
      expect(service.previousMonthExpenses()).toBe(400);
      expect(service.previousMonthBalance()).toBe(600);

      service.selectedMonth.set('2025-01');
      expect(service.hasPreviousMonth()).toBe(false);
      expect(service.previousMonthIncome()).toBe(0);
    });

    it('should shift month keys by any number of months', () => {
      expect(shiftMonth('2025-11', 3)).toBe('2026-02');
      expect(shiftMonth('2025-03', -15)).toBe('2023-12');
    });
  });

  describe('categories', () => {
    const USED: Transaction[] = [
      { id: 'a', description: 'Uber',  amount: 18000, categoryId: '4', date: '2025-01-12', type: 'expense' },
      { id: 'b', description: 'Metro', amount: 900,   categoryId: '4', date: '2025-01-13', type: 'expense' },
    ];

    beforeEach(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(USED));
      localStorage.setItem(SEEDED_KEY, 'true');
    });

    it('should add, rename and recolor categories and persist them', () => {
      const service = createService();
      const pets = service.addCategory({ name: 'Mascotas', type: 'expense', color: '#ec4899' });
      service.updateCategory('4', { name: 'Movilización', color: '#000000' });

      const saved = JSON.parse(localStorage.getItem('categories')!);
      expect(saved).toContainEqual(pets);
      expect(saved).toContainEqual({ id: '4', name: 'Movilización', type: 'expense', color: '#000000' });
    });

    it('should move transactions to the replacement when deleting a used category', () => {
      const service = createService();
      service.removeCategory('4', '8');

      expect(service.getCategoryById('4')).toBeUndefined();
      expect(stored().map(t => t.categoryId)).toEqual(['8', '8']);
    });

    it('should refuse to delete a used category without a valid replacement', () => {
      const service = createService();

      expect(() => service.removeCategory('4', null)).toThrow('Elige a qué categoría');
      expect(() => service.removeCategory('4', '1')).toThrow('Elige a qué categoría');
      expect(service.getCategoryById('4')).toBeDefined();
    });

    it('should keep the last category of a type', () => {
      const service = createService();
      service.removeCategory('2', null);

      expect(() => service.removeCategory('1', null)).toThrow('al menos una categoría');
    });
  });

  it('should look up categories by id', () => {
    const service = createService();

    expect(service.getCategoryById('3')?.name).toBe('Alimentación');
    expect(service.getCategoryById('nope')).toBeUndefined();
  });
});

describe('percentChange', () => {
  it('should return the rounded percentage change', () => {
    expect(percentChange(1120, 1000)).toBe(12);
    expect(percentChange(500, 1000)).toBe(-50);
    expect(percentChange(1000, 1000)).toBe(0);
  });

  it('should return null when there is no previous value', () => {
    expect(percentChange(500, 0)).toBeNull();
  });

  it('should measure against the size of a negative previous value', () => {
    expect(percentChange(-50, -100)).toBe(50);
    expect(percentChange(100, -100)).toBe(200);
  });
});
