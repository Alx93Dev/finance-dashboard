import { TestBed } from '@angular/core/testing';
import { AccountService } from './account.service';
import { RecurringService } from './recurring.service';
import { TransactionService } from './transaction.service';
import { Transaction } from '../models/transaction.model';

const STORED: Transaction[] = [
  { id: 'a', description: 'Sueldo',   amount: 1000000, categoryId: '1', date: '2025-01-31', type: 'income',  accountId: 'main' },
  { id: 'b', description: 'Arriendo', amount: 450000,  categoryId: '7', date: '2025-01-01', type: 'expense', accountId: 'main' },
  { id: 'c', description: 'Almuerzo', amount: 8000,    categoryId: '3', date: '2025-01-12', type: 'expense', accountId: 'cash' },
];

describe('AccountService', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('transactions', JSON.stringify(STORED));
    localStorage.setItem('accounts', JSON.stringify([
      { id: 'main', name: 'Cuenta corriente', initialBalance: 100000, currency: 'CLP' },
      { id: 'cash', name: 'Efectivo', initialBalance: 20000, currency: 'CLP' },
    ]));
    localStorage.setItem('seeded_v3', 'true');
    localStorage.setItem('schema_version', '6');
    TestBed.configureTestingModule({});
  });

  it('should add each account\'s transactions to its initial balance', () => {
    const service = TestBed.inject(AccountService);

    expect(service.balances().map(b => [b.account.id, b.balance])).toEqual([['main', 650000], ['cash', 12000]]);
    expect(service.totalBalance()).toBe(662000);
    expect(service.hasSeveral()).toBe(true);
  });

  it('should add, rename and persist accounts', () => {
    const service = TestBed.inject(AccountService);
    const card = service.add({ name: 'Tarjeta', initialBalance: -50000, currency: 'CLP' });
    service.update(card.id, { name: 'Tarjeta de crédito', initialBalance: -60000, currency: 'CLP' });

    expect(service.getById(card.id)).toEqual({ id: card.id, name: 'Tarjeta de crédito', initialBalance: -60000, currency: 'CLP' });
    expect(JSON.parse(localStorage.getItem('accounts')!)).toHaveLength(3);
  });

  it('should move transactions and recurring rules to the main account when deleting', () => {
    const service = TestBed.inject(AccountService);
    const recurring = TestBed.inject(RecurringService);
    recurring.addFrom({ ...STORED[2] });

    service.remove('cash');

    expect(service.accounts().map(a => a.id)).toEqual(['main']);
    expect(TestBed.inject(TransactionService).transactions().every(t => t.accountId === 'main')).toBe(true);
    expect(recurring.rules()[0].accountId).toBe('main');
    expect(service.balances()[0].balance).toBe(642000);
  });

  it('should not delete the main account', () => {
    expect(() => TestBed.inject(AccountService).remove('main')).toThrow('no se puede eliminar');
  });

  describe('currencies', () => {
    beforeEach(() => {
      localStorage.setItem('accounts', JSON.stringify([
        { id: 'main', name: 'Cuenta corriente', initialBalance: 100000, currency: 'CLP' },
        { id: 'cash', name: 'Dólares', initialBalance: 100, currency: 'USD' },
      ]));
      localStorage.setItem('exchange_rates', JSON.stringify({ USD: 900, UF: null, date: '2026-10-22', source: 'manual' }));
    });

    it('should keep each balance in its currency and total them in pesos', () => {
      const service = TestBed.inject(AccountService);

      expect(service.balances().map(b => [b.balance, b.balanceInClp])).toEqual([[650000, 650000], [-7900, -7110000]]);
      expect(service.totalBalance()).toBe(650000 - 7110000);
      expect(service.hasForeignCurrency()).toBe(true);
      expect(service.missingRates()).toEqual([]);
    });

    it('should value transactions of foreign accounts in pesos for totals', () => {
      const tx = TestBed.inject(TransactionService);

      expect(tx.totalExpenses()).toBe(450000 + 8000 * 900);
      expect(tx.transactions().find(t => t.id === 'c')!.amount).toBe(8000);
    });

    it('should ask for the received amount when a transfer changes currency', () => {
      const service = TestBed.inject(AccountService);

      expect(() => service.transfer({ fromAccountId: 'main', toAccountId: 'cash', amount: 90000, date: '2025-01-15', description: '' }))
        .toThrow('cuánto llegó');
      service.transfer({ fromAccountId: 'main', toAccountId: 'cash', amount: 90000, toAmount: 95, date: '2025-01-15', description: '' });

      expect(service.balances().map(b => b.balance)).toEqual([560000, -7805]);
    });

    it('should report currencies without a known value', () => {
      localStorage.setItem('exchange_rates', JSON.stringify({}));
      const service = TestBed.inject(AccountService);

      expect(service.missingRates()).toEqual(['USD']);
      expect(service.totalBalance()).toBe(650000);
    });
  });

  describe('transfers', () => {
    it('should move money between accounts without touching income or expenses', () => {
      const service = TestBed.inject(AccountService);
      const tx = TestBed.inject(TransactionService);
      const before = { income: tx.totalIncome(), expenses: tx.totalExpenses() };

      service.transfer({ fromAccountId: 'main', toAccountId: 'cash', amount: 50000, date: '2025-01-15', description: 'Cajero' });

      expect(service.balances().map(b => b.balance)).toEqual([600000, 62000]);
      expect(service.totalBalance()).toBe(662000);
      expect({ income: tx.totalIncome(), expenses: tx.totalExpenses() }).toEqual(before);
      expect(JSON.parse(localStorage.getItem('transfers')!)).toHaveLength(1);
    });

    it('should list transfers from most recent and delete them', () => {
      const service = TestBed.inject(AccountService);
      const older = service.transfer({ fromAccountId: 'main', toAccountId: 'cash', amount: 1000, date: '2025-01-01', description: '' });
      const newer = service.transfer({ fromAccountId: 'cash', toAccountId: 'main', amount: 2000, date: '2025-01-20', description: '' });

      expect(service.recentTransfers().map(t => t.id)).toEqual([newer.id, older.id]);
      service.removeTransfer(newer.id);
      expect(service.transfers().map(t => t.id)).toEqual([older.id]);
    });

    it('should refuse a transfer to the same account', () => {
      expect(() => TestBed.inject(AccountService).transfer({
        fromAccountId: 'main', toAccountId: 'main', amount: 1000, date: '2025-01-01', description: '',
      })).toThrow('dos cuentas distintas');
    });

    it('should drop transfers that would end up inside the main account when deleting', () => {
      const service = TestBed.inject(AccountService);
      const card = service.add({ name: 'Tarjeta', initialBalance: 0, currency: 'CLP' });
      service.transfer({ fromAccountId: 'main', toAccountId: 'cash', amount: 1000, date: '2025-01-01', description: '' });
      service.transfer({ fromAccountId: 'cash', toAccountId: card.id, amount: 500, date: '2025-01-02', description: '' });

      service.remove('cash');

      expect(service.transfers().map(t => [t.fromAccountId, t.toAccountId])).toEqual([['main', card.id]]);
    });
  });
});
