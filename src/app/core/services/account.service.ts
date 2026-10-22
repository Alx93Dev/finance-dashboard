import { Injectable, computed, inject, signal } from '@angular/core';
import { Account, DEFAULT_ACCOUNTS, MAIN_ACCOUNT_ID } from '../models/account.model';
import { Transfer } from '../models/transfer.model';
import { ExchangeRateService } from './exchange-rate.service';
import { RecurringService } from './recurring.service';
import { StorageService } from './storage.service';
import { TransactionService } from './transaction.service';

const STORAGE_KEY = 'accounts';
const TRANSFERS_KEY = 'transfers';

export interface AccountBalance {
  account: Account;
  /** In the account's currency. */
  balance: number;
  /** The balance in pesos; 0 while the currency's value isn't known. */
  balanceInClp: number;
}

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly storage = inject(StorageService);
  private readonly tx = inject(TransactionService);
  private readonly recurring = inject(RecurringService);
  private readonly rates = inject(ExchangeRateService);

  readonly accounts = signal<Account[]>(this.storage.get<Account[]>(STORAGE_KEY, DEFAULT_ACCOUNTS));
  readonly transfers = signal<Transfer[]>(this.storage.get<Transfer[]>(TRANSFERS_KEY, []));

  /** Transfers from most recent to oldest. */
  readonly recentTransfers = computed(() =>
    [...this.transfers()].sort((a, b) => b.date.localeCompare(a.date))
  );

  /** Whether there is more than one account, so the UI should let the user pick. */
  readonly hasSeveral = computed(() => this.accounts().length > 1);

  /** Whether any account is in a currency other than pesos. */
  readonly hasForeignCurrency = computed(() => this.accounts().some(a => a.currency !== 'CLP'));

  /**
   * Each account's initial balance plus its income minus its expenses and net
   * transfers, in its own currency and in pesos, in account order.
   */
  readonly balances = computed<AccountBalance[]>(() => {
    const totals = new Map<string, number>();
    for (const t of this.tx.transactions()) {
      const signed = t.type === 'income' ? t.amount : -t.amount;
      totals.set(t.accountId, (totals.get(t.accountId) ?? 0) + signed);
    }
    for (const t of this.transfers()) {
      totals.set(t.fromAccountId, (totals.get(t.fromAccountId) ?? 0) - t.amount);
      totals.set(t.toAccountId, (totals.get(t.toAccountId) ?? 0) + this.receivedAmount(t));
    }
    return this.accounts().map(account => {
      const balance = account.initialBalance + (totals.get(account.id) ?? 0);
      return { account, balance, balanceInClp: this.rates.toClp(balance, account.currency) };
    });
  });

  /** Sum of every balance, in pesos. */
  readonly totalBalance = computed(() => this.balances().reduce((sum, b) => sum + b.balanceInClp, 0));

  /** Currencies used by some account whose value in pesos isn't known yet. */
  readonly missingRates = computed(() =>
    [...new Set(this.accounts().map(a => a.currency))].filter(c => this.rates.rate(c) === null)
  );

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

  /** Number of transactions and transfers recorded in an account. */
  usage(id: string): number {
    return this.tx.transactions().filter(t => t.accountId === id).length +
      this.transfers().filter(t => t.fromAccountId === id || t.toAccountId === id).length;
  }

  /**
   * Deletes an account, moving its transactions, recurring rules and
   * transfers to the main account. Transfers that would then go from the main
   * account to itself are dropped.
   */
  remove(id: string): void {
    if (id === MAIN_ACCOUNT_ID) throw new Error('La cuenta principal no se puede eliminar.');
    if (!this.getById(id)) return;
    this.tx.reassignAccount(id, MAIN_ACCOUNT_ID);
    this.recurring.reassignAccount(id, MAIN_ACCOUNT_ID);
    const move = (accountId: string) => (accountId === id ? MAIN_ACCOUNT_ID : accountId);
    this.setTransfers(this.transfers()
      .map(t => ({ ...t, fromAccountId: move(t.fromAccountId), toAccountId: move(t.toAccountId) }))
      .filter(t => t.fromAccountId !== t.toAccountId));
    this.setAccounts(this.accounts().filter(a => a.id !== id));
  }

  /** Whether a transfer between these accounts changes currency, so the received amount is asked for too. */
  changesCurrency(fromId: string, toId: string): boolean {
    const from = this.getById(fromId);
    const to = this.getById(toId);
    return !!from && !!to && from.currency !== to.currency;
  }

  /** What the destination account got, in its own currency. */
  receivedAmount(transfer: Transfer): number {
    return this.changesCurrency(transfer.fromAccountId, transfer.toAccountId)
      ? transfer.toAmount ?? transfer.amount
      : transfer.amount;
  }

  transfer(transfer: Omit<Transfer, 'id'>): Transfer {
    if (transfer.fromAccountId === transfer.toAccountId) {
      throw new Error('Elige dos cuentas distintas.');
    }
    const { toAmount, ...rest } = transfer;
    const created: Transfer = { ...rest, id: crypto.randomUUID() };
    if (this.changesCurrency(transfer.fromAccountId, transfer.toAccountId)) {
      if (!(toAmount !== undefined && toAmount > 0)) throw new Error('Indica cuánto llegó a la otra cuenta.');
      created.toAmount = toAmount;
    }
    this.setTransfers([...this.transfers(), created]);
    return created;
  }

  removeTransfer(id: string): void {
    this.setTransfers(this.transfers().filter(t => t.id !== id));
  }

  /** Replaces every stored account, e.g. when restoring a backup; drops transfers to accounts that are gone. */
  replaceAll(accounts: Account[]): void {
    this.setAccounts(accounts);
    const ids = new Set(accounts.map(a => a.id));
    this.setTransfers(this.transfers().filter(t => ids.has(t.fromAccountId) && ids.has(t.toAccountId)));
  }

  /** Replaces every stored transfer, e.g. when restoring a backup. */
  replaceTransfers(transfers: Transfer[]): void {
    this.setTransfers(transfers);
  }

  private setTransfers(transfers: Transfer[]): void {
    this.transfers.set(transfers);
    this.storage.set(TRANSFERS_KEY, transfers);
  }

  private setAccounts(accounts: Account[]): void {
    this.accounts.set(accounts);
    this.storage.set(STORAGE_KEY, accounts);
  }
}
