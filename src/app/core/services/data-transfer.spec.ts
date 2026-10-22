import { BACKUP_APP_ID, parseBackup, toBackup, toCsv } from './data-transfer';
import { DEFAULT_CATEGORIES } from '../models/category.model';
import { Transaction } from '../models/transaction.model';

const TRANSACTIONS: Transaction[] = [
  { id: 'b', description: 'Sueldo',             amount: 1200000, categoryId: '1', date: '2025-01-31', type: 'income'  },
  { id: 'a', description: 'Cena "especial", 2', amount: 45000,   categoryId: '3', date: '2025-01-10', type: 'expense' },
];

describe('toCsv', () => {
  it('should write a header and one row per transaction, oldest first', () => {
    expect(toCsv(TRANSACTIONS, DEFAULT_CATEGORIES).split('\r\n')).toEqual([
      'Fecha,Descripción,Tipo,Categoría,Monto',
      '2025-01-10,"Cena ""especial"", 2",Gasto,Alimentación,45000',
      '2025-01-31,Sueldo,Ingreso,Sueldo,1200000',
    ]);
  });
});

describe('parseBackup', () => {
  const BUDGETS = [{ categoryId: '3', amount: 200000 }];
  const backupText = (overrides: object = {}) =>
    JSON.stringify({
      ...toBackup({ transactions: TRANSACTIONS, budgets: BUDGETS }, 2, new Date('2025-02-01T00:00:00Z')),
      ...overrides,
    });

  it('should round-trip a backup', () => {
    expect(parseBackup(backupText(), 2)).toEqual({ transactions: TRANSACTIONS, budgets: BUDGETS });
  });

  it('should read a backup made before budgets existed', () => {
    const v1 = { app: BACKUP_APP_ID, schemaVersion: 1, exportedAt: '', transactions: TRANSACTIONS };
    expect(parseBackup(JSON.stringify(v1), 2)).toEqual({ transactions: TRANSACTIONS, budgets: null });
  });

  it('should reject a backup with a damaged budget', () => {
    expect(() => parseBackup(backupText({ budgets: [{ categoryId: '3', amount: -1 }] }), 2))
      .toThrow('presupuestos dañados');
  });

  it('should reject text that is not JSON', () => {
    expect(() => parseBackup('no es json', 2)).toThrow('El archivo no es un JSON válido.');
  });

  it('should reject JSON that is not a backup from this app', () => {
    expect(() => parseBackup('[]', 2)).toThrow('El archivo no es un respaldo de Finance Dashboard.');
    expect(() => parseBackup(backupText({ app: 'otra-app' }), 2)).toThrow('no es un respaldo');
  });

  it('should reject a backup from a newer schema version', () => {
    expect(() => parseBackup(backupText({ schemaVersion: 3 }), 2)).toThrow('versión más nueva');
  });

  it('should reject a backup with a damaged transaction', () => {
    const damaged = { app: BACKUP_APP_ID, schemaVersion: 1, transactions: [{ ...TRANSACTIONS[0], amount: 'mucho' }] };
    expect(() => parseBackup(JSON.stringify(damaged), 1)).toThrow('transacciones dañadas');
  });
});
