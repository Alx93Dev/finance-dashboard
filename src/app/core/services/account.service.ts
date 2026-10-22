import { Injectable, computed, inject, signal } from '@angular/core';
import { Account, DEFAULT_ACCOUNTS, MAIN_ACCOUNT_ID } from '../models/account.model';
import { RecurringService } from './recurring.service';
import { StorageService } from './storage.service';
import { TransactionService } from './transaction.service';

const STORAGE_KEY = 'accounts';

export interface AccountBalance {
  account: Account;
  balance: number;
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly storage = inject(StorageService);
  private readonly tx = inject(TransactionService);
  private readonly recurring = inject(RecurringService);

  readonly accounts = signal<Account[]>(this.storage.get<Account[]>(STORAGE_KEY, DEFAULT_ACCOUNTS));

  /** Whether there is more than one account, so the UI should let the user pick. */
  readonly hasSeveral = computed(() => this.accounts().length > 1);

  /** Each account's initial balance plus its income minus its expenses, in account order. */
  readonly balances = computed<AccountBalance[]>(() => {
    const totals = new Map<string, number>();
    for (const t of this.tx.transactions()) {
      const signed = t.type === 'income' ? t.amount : -t.amount;
      totals.set(t.accountId, (totals.get(t.accountId) ?? 0) + signed);
    }
    return this.accounts().map(account => ({
      account,
      balance: account.initialBalance + (totals.get(account.id) ?? 0),
    }));
  });

  readonly totalBalance = computed(() => this.balances().reduce((sum, b) => sum + b.balance, 0));

  getById(id: string): Account | undefined {
    return this.accounts().find(a => a.id === id);
  }

  add(account: Omit<Account, 'id'>): Account {
    const created: Account = { ...account, id: crypto.randomUUID() };
    this.setAccounts([...this.accounts(), created]);
    return created;
  }

  update(id: string, changes: Omit<Account, 'id'>): void {
    this.setAccounts(this.accounts().map(a => (a.id === id ? { ...a, ...changes } : a)));
  }

  /** Number of transactions recorded in an account. */
  usage(id: string): number {
    return this.tx.transactions().filter(t => t.accountId === id).length;
  }

  /** Deletes an account, moving its transactions and recurring rules to the main account. */
  remove(id: string): void {
    if (id === MAIN_ACCOUNT_ID) throw new Error('La cuenta principal no se puede eliminar.');
    if (!this.getById(id)) return;
    this.tx.reassignAccount(id, MAIN_ACCOUNT_ID);
    this.recurring.reassignAccount(id, MAIN_ACCOUNT_ID);
    this.setAccounts(this.accounts().filter(a => a.id !== id));
  }

  /** Replaces every stored account, e.g. when restoring a backup. */
  replaceAll(accounts: Account[]): void {
    this.setAccounts(accounts);
  }

  private setAccounts(accounts: Account[]): void {
    this.accounts.set(accounts);
    this.storage.set(STORAGE_KEY, accounts);
  }
}
