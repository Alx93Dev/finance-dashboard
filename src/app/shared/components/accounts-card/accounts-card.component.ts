import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MAIN_ACCOUNT_ID } from '../../../core/models/account.model';
import { AccountService } from '../../../core/services/account.service';

const BUTTON = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
/** How many transfers the card lists. */
const LATEST_TRANSFERS = 5;
const INPUT = 'px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/**
 * An account row in the edit form; `id` is null for one that doesn't exist
 * yet. Names and balances are read from the form when saving.
 */
interface Draft {
  key: number;
  id: string | null;
  name: string;
  initialBalance: number;
  removed: boolean;
}

@Component({
  selector: 'app-accounts-card',
  imports: [CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
      <div class="flex items-center justify-between gap-4 mb-4">
        <h2 id="accounts-heading" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Cuentas</h2>
        @if (!drafts() && !transferring()) {
          <div class="flex gap-2">
            @if (accounts.hasSeveral()) {
              <button type="button" [class]="buttonClass" (click)="transferring.set(true)">Transferir</button>
            }
            <button type="button" [class]="buttonClass" (click)="startEditing()">Editar</button>
          </div>
        }
      </div>

      @if (drafts(); as rows) {
        <form (submit)="save($event)" class="space-y-3">
          <p class="text-sm text-gray-500 dark:text-gray-400">El saldo inicial es lo que tenía la cuenta antes de tu primer movimiento.</p>
          @for (row of rows; track row.key) {
            @if (!row.removed) {
              <div>
                <div class="flex items-center gap-2">
                  <label [for]="'account-name-' + row.key" class="sr-only">Nombre de la cuenta</label>
                  <input
                    [id]="'account-name-' + row.key"
                    required
                    maxlength="40"
                    placeholder="Ej: Efectivo"
                    [name]="'name-' + row.key"
                    [value]="row.name"
                    [class]="inputClass + ' min-w-0 flex-1'"
                  />
                  <label [for]="'account-balance-' + row.key" class="sr-only">Saldo inicial</label>
                  <input
                    [id]="'account-balance-' + row.key"
                    type="number"
                    inputmode="numeric"
                    placeholder="Saldo inicial"
                    [name]="'balance-' + row.key"
                    [value]="row.initialBalance"
                    [class]="inputClass + ' w-28 text-right tabular-nums'"
                  />
                  @if (row.id !== mainId) {
                    <button
                      type="button"
                      (click)="patch(row.key, { removed: true })"
                      class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                      [attr.aria-label]="'Eliminar ' + (row.name || 'cuenta nueva')"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                      </svg>
                    </button>
                  } @else {
                    <span class="w-7 shrink-0"></span>
                  }
                </div>
              </div>
            } @else if (row.id && accounts.usage(row.id) > 0) {
              @let count = accounts.usage(row.id);
              <p class="text-xs text-amber-600 dark:text-amber-400">
                Al guardar,
                {{ count === 1 ? 'el movimiento' : 'los ' + count + ' movimientos' }}
                de {{ accounts.getById(row.id)?.name }} {{ count === 1 ? 'pasará' : 'pasarán' }} a {{ mainName() }}.
              </p>
            }
          }
          <div class="flex flex-wrap justify-between gap-2 pt-1">
            <button type="button" [class]="buttonClass" (click)="addRow()">Agregar cuenta</button>
            <div class="flex gap-2">
              <button type="button" [class]="buttonClass" (click)="drafts.set(null)">Cancelar</button>
              <button type="submit" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Guardar</button>
            </div>
          </div>
        </form>
      } @else if (transferring()) {
        <form (submit)="saveTransfer($event)" class="space-y-3" aria-label="Nueva transferencia">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="transfer-from" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Desde</label>
              <select id="transfer-from" name="from" [class]="inputClass + ' w-full'">
                @for (account of accounts.accounts(); track account.id; let first = $first) {
                  <option [value]="account.id" [selected]="first">{{ account.name }}</option>
                }
              </select>
            </div>
            <div>
              <label for="transfer-to" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hacia</label>
              <select id="transfer-to" name="to" [class]="inputClass + ' w-full'">
                @for (account of accounts.accounts(); track account.id; let index = $index) {
                  <option [value]="account.id" [selected]="index === 1">{{ account.name }}</option>
                }
              </select>
            </div>
            <div>
              <label for="transfer-amount" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Monto</label>
              <input id="transfer-amount" name="amount" type="number" min="1" inputmode="numeric" required [class]="inputClass + ' w-full text-right tabular-nums'" />
            </div>
            <div>
              <label for="transfer-date" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha</label>
              <input id="transfer-date" name="date" type="date" required [value]="today()" [class]="inputClass + ' w-full'" />
            </div>
          </div>
          <div>
            <label for="transfer-description" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nota (opcional)</label>
            <input id="transfer-description" name="description" maxlength="60" placeholder="Ej: Pago de tarjeta" [class]="inputClass + ' w-full'" />
          </div>
          @if (transferError(); as error) {
            <p class="text-xs text-red-600 dark:text-red-400" role="alert">{{ error }}</p>
          }
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" [class]="buttonClass" (click)="closeTransfer()">Cancelar</button>
            <button type="submit" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Transferir</button>
          </div>
        </form>
      } @else {
        <ul class="divide-y divide-gray-100 dark:divide-gray-800" aria-labelledby="accounts-heading">
          @for (item of accounts.balances(); track item.account.id) {
            <li class="flex items-baseline justify-between gap-4 py-2 text-sm first:pt-0">
              <span class="text-gray-700 dark:text-gray-300">{{ item.account.name }}</span>
              <span class="whitespace-nowrap font-medium tabular-nums" [class]="balanceClass(item.balance)">{{ item.balance | currency:'$':'symbol':'1.0-0' }}</span>
            </li>
          }
          @if (accounts.hasSeveral()) {
            <li class="flex items-baseline justify-between gap-4 pt-2 text-sm">
              <span class="font-semibold text-gray-900 dark:text-gray-100">Total</span>
              <span class="whitespace-nowrap font-semibold tabular-nums" [class]="balanceClass(accounts.totalBalance())">{{ accounts.totalBalance() | currency:'$':'symbol':'1.0-0' }}</span>
            </li>
          }
        </ul>
        @if (!accounts.hasSeveral()) {
          <p class="mt-3 text-xs text-gray-400 dark:text-gray-500">Agrega más cuentas, como efectivo o tarjeta, para ver el saldo de cada una.</p>
        }
        <button type="button" [class]="buttonClass + ' mt-3'" (click)="startAdding()">Agregar cuenta</button>
        @if (latestTransfers().length > 0) {
          <h3 id="transfers-heading" class="mt-5 mb-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Últimas transferencias</h3>
          <ul class="space-y-2" aria-labelledby="transfers-heading">
            @for (transfer of latestTransfers(); track transfer.id) {
              <li class="flex items-center justify-between gap-3 text-sm">
                <div class="min-w-0">
                  <p class="truncate text-gray-700 dark:text-gray-300">{{ accountName(transfer.fromAccountId) }} → {{ accountName(transfer.toAccountId) }}</p>
                  <p class="truncate text-xs text-gray-400 dark:text-gray-500">{{ transfer.date | date:'d MMM y' }}@if (transfer.description) { · {{ transfer.description }}}</p>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  <span class="whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">{{ transfer.amount | currency:'$':'symbol':'1.0-0' }}</span>
                  <button
                    type="button"
                    (click)="accounts.removeTransfer(transfer.id)"
                    class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                    [attr.aria-label]="'Eliminar transferencia de ' + accountName(transfer.fromAccountId) + ' a ' + accountName(transfer.toAccountId)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
})
export class AccountsCardComponent {
  protected readonly accounts = inject(AccountService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly buttonClass = BUTTON;
  protected readonly inputClass = INPUT;
  protected readonly mainId = MAIN_ACCOUNT_ID;
  protected readonly drafts = signal<Draft[] | null>(null);
  protected readonly transferring = signal(false);
  protected readonly transferError = signal<string | null>(null);
  protected readonly latestTransfers = computed(() => this.accounts.recentTransfers().slice(0, LATEST_TRANSFERS));
  protected readonly mainName = computed(() => this.accounts.getById(MAIN_ACCOUNT_ID)?.name ?? 'la cuenta principal');
  private nextKey = 0;

  protected today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  protected accountName(id: string): string {
    return this.accounts.getById(id)?.name ?? '—';
  }

  protected closeTransfer(): void {
    this.transferring.set(false);
    this.transferError.set(null);
  }

  protected saveTransfer(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const amount = Number(data.get('amount'));
    if (!(amount > 0)) return;
    try {
      this.accounts.transfer({
        fromAccountId: String(data.get('from')),
        toAccountId: String(data.get('to')),
        amount,
        date: String(data.get('date')),
        description: String(data.get('description') ?? '').trim(),
      });
      this.closeTransfer();
    } catch (error) {
      this.transferError.set((error as Error).message);
    }
  }

  protected balanceClass(balance: number): string {
    return balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100';
  }

  protected startEditing(): void {
    this.drafts.set(this.accounts.accounts().map(a => ({
      key: this.nextKey++, id: a.id, name: a.name, initialBalance: a.initialBalance, removed: false,
    })));
  }

  protected addRow(): void {
    const key = this.nextKey++;
    this.drafts.update(rows => [...(rows ?? []), { key, id: null, name: '', initialBalance: 0, removed: false }]);
    // Focus the new name field once it is rendered.
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>(`#account-name-${key}`)?.focus(), { injector: this.injector });
  }

  /** Opens the edit form with an empty row for a new account. */
  protected startAdding(): void {
    this.startEditing();
    this.addRow();
  }

  protected patch(key: number, changes: Partial<Draft>): void {
    this.drafts.update(rows => rows?.map(r => (r.key === key ? { ...r, ...changes } : r)) ?? null);
  }

  protected save(event: Event): void {
    event.preventDefault();
    const rows = this.drafts();
    if (!rows) return;
    const data = new FormData(event.target as HTMLFormElement);
    const values = rows.filter(r => !r.removed).map(row => ({
      row,
      name: String(data.get(`name-${row.key}`) ?? '').trim(),
      initialBalance: Number(data.get(`balance-${row.key}`)) || 0,
    }));
    if (values.some(v => !v.name)) return;

    for (const row of rows) {
      if (row.removed && row.id) this.accounts.remove(row.id);
    }
    for (const { row, name, initialBalance } of values) {
      if (row.id) this.accounts.update(row.id, { name, initialBalance });
      else this.accounts.add({ name, initialBalance });
    }
    this.drafts.set(null);
  }
}
