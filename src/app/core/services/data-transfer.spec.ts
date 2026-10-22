import { BACKUP_APP_ID, parseBackup, toBackup, toCsv } from './data-transfer';
import { Account, DEFAULT_ACCOUNTS } from '../models/account.model';
import { DEFAULT_CATEGORIES } from '../models/category.model';
import { Transaction } from '../models/transaction.model';

const TRANSACTIONS: Transaction[] = [
  { id: 'b', description: 'Sueldo',             amount: 1200000, categoryId: '1', date: '2025-01-31', type: 'income',  accountId: 'main' },
  { id: 'a', description: 'Cena "especial", 2', amount: 45000,   categoryId: '3', date: '2025-01-10', type: 'expense', accountId: 'cash' },
];
const ACCOUNTS: Account[] = [...DEFAULT_ACCOUNTS, { id: 'cash', name: 'Efectivo', initialBalance: 20000, currency: 'CLP' }];
const TRANSFERS = [{ id: 't', fromAccountId: 'main', toAccountId: 'cash', amount: 50000, date: '2025-01-15', description: 'Cajero' }];

describe('toCsv', () => {
  it('should write a header and one row per transaction, oldest first', () => {
    expect(toCsv(TRANSACTIONS, DEFAULT_CATEGORIES, ACCOUNTS).split('\r\n')).toEqual([
      'Fecha,Descripción,Tipo,Categoría,Cuenta,Monto,Moneda',
      '2025-01-10,"Cena ""especial"", 2",Gasto,Alimentación,Efectivo,45000,CLP',
      '2025-01-31,Sueldo,Ingreso,Sueldo,Cuenta principal,1200000,CLP',
    ]);
  });
});

describe('parseBackup', () => {
  const BUDGETS = [{ categoryId: '3', amount: 200000 }];
  const RECURRING = [{ id: 'r', description: 'Arriendo', amount: 450000, categoryId: '7', type: 'expense' as const, accountId: 'main', dayOfMonth: 1, lastMonth: '2025-01' }];
  const GOALS = [
    { id: 'g', name: 'Viaje', target: 1000000, saved: 250000, deadline: '2025-12-31' },
    { id: 'h', name: 'Fondo de emergencia', target: 3000000, saved: 0, deadline: null },
  ];
  const CATEGORIES = [...DEFAULT_CATEGORIES, { id: 'x', name: 'Mascotas', type: 'expense' as const, color: '#ec4899' }];
  const backupText = (overrides: object = {}) =>
    JSON.stringify({
      ...toBackup({ transactions: TRANSACTIONS, budgets: BUDGETS, categories: CATEGORIES, recurring: RECURRING, goals: GOALS, accounts: ACCOUNTS, transfers: TRANSFERS }, 7, new Date('2025-02-01T00:00:00Z')),
      ...overrides,
    });

  it('should round-trip a backup', () => {
    expect(parseBackup(backupText(), 7)).toEqual({ transactions: TRANSACTIONS, budgets: BUDGETS, categories: CATEGORIES, recurring: RECURRING, goals: GOALS, accounts: ACCOUNTS, transfers: TRANSFERS, defaultAccountId: 'main' });
  });

  it('should read accounts from before currencies as pesos and keep cross-currency transfers', () => {
    const accounts = [
      { id: 'main', name: 'Cuenta principal', initialBalance: 0 },
      { id: 'usd', name: 'Dólares', initialBalance: 10, currency: 'USD' },
    ];
    const transfers = [{ ...TRANSFERS[0], toAccountId: 'usd', toAmount: 52.5 }];
    const parsed = parseBackup(backupText({ accounts, transfers }), 8);

    expect(parsed.accounts!.map(a => a.currency)).toEqual(['CLP', 'USD']);
    expect(parsed.transfers![0].toAmount).toBe(52.5);
    expect(() => parseBackup(backupText({ accounts: [{ ...accounts[1], currency: 'EUR' }] }), 8)).toThrow();
  });

  it('should read a backup made before budgets existed into the main account', () => {
    const v1 = {
      app: BACKUP_APP_ID,
      schemaVersion: 1,
      exportedAt: '',
      transactions: TRANSACTIONS.map(({ accountId: _, ...t }) => t),
    };
    expect(parseBackup(JSON.stringify(v1), 7)).toEqual({
      transactions: TRANSACTIONS.map(t => ({ ...t, accountId: 'main' })),
      budgets: null,
      categories: null,
      recurring: null,
      goals: null,
      accounts: null,
      transfers: null,
      defaultAccountId: null,
    });
  });

  it('should move transactions of unknown accounts to the default account', () => {
    const parsed = parseBackup(backupText({ accounts: [{ id: 'other', name: 'Otra', initialBalance: 0, currency: 'CLP' }] }), 7);
    expect(parsed.accounts!.map(a => a.id)).toEqual(['other']);
    expect(parsed.defaultAccountId).toBe('other');
    expect(parsed.transactions.map(t => t.accountId)).toEqual(['other', 'other']);
    // Its only transfer would now go from the default account to itself.
    expect(parsed.transfers).toEqual([]);
  });

  it('should keep the chosen default account', () => {
    const accounts = [
      { id: 'main', name: 'Cuenta principal', initialBalance: 0, currency: 'CLP' },
      { id: 'bci', name: 'BCI', initialBalance: 0, currency: 'CLP' },
    ];
    const transactions = [{ ...TRANSACTIONS[0], accountId: 'gone' }];
    const parsed = parseBackup(backupText({ accounts, transactions, defaultAccountId: 'bci' }), 8);
    expect(parsed.defaultAccountId).toBe('bci');
    expect(parsed.transactions[0].accountId).toBe('bci');
    expect(parseBackup(backupText({ accounts, defaultAccountId: 'gone' }), 8).defaultAccountId).toBe('main');
  });

  it('should reject a backup with a damaged transfer', () => {
    expect(() => parseBackup(backupText({ transfers: [{ ...TRANSFERS[0], toAccountId: 'main' }] }), 7))
      .toThrow('transferencias dañadas');
  });

  it('should reject a backup with a damaged account', () => {
    expect(() => parseBackup(backupText({ accounts: [{ id: 'x', name: 'Sin saldo' }] }), 7))
      .toThrow('cuentas dañadas');
  });

  it('should reject a backup with a damaged budget', () => {
    expect(() => parseBackup(backupText({ budgets: [{ categoryId: '3', amount: -1 }] }), 7))
      .toThrow('presupuestos dañados');
  });

  it('should reject a backup with a damaged recurring rule', () => {
    expect(() => parseBackup(backupText({ recurring: [{ ...RECURRING[0], dayOfMonth: 32 }] }), 7))
      .toThrow('recurrentes dañadas');
  });

  it('should reject a backup with a damaged goal', () => {
    expect(() => parseBackup(backupText({ goals: [{ ...GOALS[0], target: 0 }] }), 7))
      .toThrow('metas dañadas');
  });

  it('should reject a backup with a damaged category', () => {
    expect(() => parseBackup(backupText({ categories: [{ id: 'x', name: 'Sin tipo', color: '#000' }] }), 7))
      .toThrow('categorías dañadas');
  });

  it('should reject text that is not JSON', () => {
    expect(() => parseBackup('no es json', 7)).toThrow('El archivo no es un JSON válido.');
  });

  it('should reject JSON that is not a backup from this app', () => {
    expect(() => parseBackup('[]', 7)).toThrow('El archivo no es un respaldo de Finance Dashboard.');
    expect(() => parseBackup(backupText({ app: 'otra-app' }), 7)).toThrow('no es un respaldo');
  });

  it('should reject a backup from a newer schema version', () => {
    expect(() => parseBackup(backupText({ schemaVersion: 8 }), 7)).toThrow('versión más nueva');
  });

  it('should reject a backup with a damaged transaction', () => {
    const damaged = { app: BACKUP_APP_ID, schemaVersion: 1, transactions: [{ ...TRANSACTIONS[0], amount: 'mucho' }] };
    expect(() => parseBackup(JSON.stringify(damaged), 1)).toThrow('transacciones dañadas');
  });
});
