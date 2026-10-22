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
      { id: 'main', name: 'Cuenta corriente', initialBalance: 100000 },
      { id: 'cash', name: 'Efectivo', initialBalance: 20000 },
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
    const card = service.add({ name: 'Tarjeta', initialBalance: -50000 });
    service.update(card.id, { name: 'Tarjeta de crédito', initialBalance: -60000 });

    expect(service.getById(card.id)).toEqual({ id: card.id, name: 'Tarjeta de crédito', initialBalance: -60000 });
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
});
