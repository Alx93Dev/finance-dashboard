import { TestBed } from '@angular/core/testing';
import { SCHEMA_VERSION_KEY, StorageService } from './storage.service';
import { MIGRATIONS, Migration } from './storage-migrations';
import { DEFAULT_CATEGORIES } from '../models/category.model';

function createService(): StorageService {
  return TestBed.inject(StorageService);
}

describe('StorageService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('should return the fallback for missing or corrupt values', () => {
    const service = createService();
    localStorage.setItem('broken', '{not json');

    expect(service.get('missing', 42)).toBe(42);
    expect(service.get('broken', [])).toEqual([]);
  });

  it('should stamp fresh storage with the latest schema version', () => {
    const service = createService();
    const latest = Math.max(...MIGRATIONS.map(m => m.version));

    expect(service.schemaVersion()).toBe(latest);
    expect(localStorage.getItem(SCHEMA_VERSION_KEY)).toBe(String(latest));
  });

  describe('runMigrations', () => {
    function recorder(log: number[], ...versions: number[]): Migration[] {
      return versions.map(version => ({
        version,
        description: `v${version}`,
        migrate: () => log.push(version),
      }));
    }

    it('should run pending migrations once, in order', () => {
      const service = createService();
      localStorage.setItem(SCHEMA_VERSION_KEY, '1');
      const log: number[] = [];

      service.runMigrations(recorder(log, 3, 1, 2));
      service.runMigrations(recorder(log, 3, 1, 2));

      expect(log).toEqual([2, 3]);
      expect(service.schemaVersion()).toBe(3);
    });

    it('should leave data from a newer app version alone', () => {
      const service = createService();
      localStorage.setItem(SCHEMA_VERSION_KEY, '5');
      const log: number[] = [];

      service.runMigrations(recorder(log, 1, 2));

      expect(log).toEqual([]);
      expect(service.schemaVersion()).toBe(5);
    });
  });

  describe('migration v1', () => {
    it('should keep valid transactions, coerce numeric amounts and drop malformed ones', () => {
      localStorage.setItem('transactions', JSON.stringify([
        { id: 'a', description: 'Sueldo', amount: 1000, categoryId: '1', date: '2025-01-31', type: 'income' },
        { id: 'b', description: 'Uber', amount: '1800', categoryId: '4', date: '2025-01-12', type: 'expense' },
        { id: 'c', description: 'Sin monto', categoryId: '8', date: '2025-01-01', type: 'expense' },
        { id: 'd', description: 'Tipo raro', amount: 5, categoryId: '8', date: '2025-01-01', type: 'transfer' },
        null,
      ]));

      const service = createService();

      expect(service.get('transactions', [])).toEqual([
        { id: 'a', description: 'Sueldo', amount: 1000, categoryId: '1', date: '2025-01-31', type: 'income' },
        { id: 'b', description: 'Uber', amount: 1800, categoryId: '4', date: '2025-01-12', type: 'expense' },
      ]);
      expect(service.schemaVersion()).toBe(Math.max(...MIGRATIONS.map(m => m.version)));
    });

    it('should reset transactions that are not a list', () => {
      localStorage.setItem('transactions', JSON.stringify({ oops: true }));

      expect(createService().get('transactions', null)).toEqual([]);
    });
  });

  describe('migration v2', () => {
    it('should create an empty budget list', () => {
      expect(createService().get('budgets', null)).toEqual([]);
    });

    it('should keep valid budgets and drop malformed ones', () => {
      localStorage.setItem(SCHEMA_VERSION_KEY, '1');
      localStorage.setItem('budgets', JSON.stringify([
        { categoryId: '3', amount: 200000 },
        { categoryId: '4', amount: 0 },
        { amount: 1000 },
        null,
      ]));

      expect(createService().get('budgets', null)).toEqual([{ categoryId: '3', amount: 200000 }]);
    });
  });

  describe('migration v3', () => {
    it('should store the default categories', () => {
      expect(createService().get('categories', null)).toEqual(DEFAULT_CATEGORIES);
    });

    it('should keep valid stored categories', () => {
      const custom = [
        { id: 'a', name: 'Sueldo', type: 'income', color: '#10b981' },
        { id: 'b', name: 'Mascotas', type: 'expense', color: '#ec4899' },
        { id: 'c', name: 'Sin tipo', color: '#000' },
      ];
      localStorage.setItem(SCHEMA_VERSION_KEY, '2');
      localStorage.setItem('categories', JSON.stringify(custom));

      expect(createService().get('categories', null)).toEqual(custom.slice(0, 2));
    });
  });
});
