import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MAIN_ACCOUNT_ID } from '../../../core/models/account.model';
import { CURRENCIES, Currency, isCurrency } from '../../../core/models/currency.model';
import { AccountService } from '../../../core/services/account.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { MoneyPipe } from '../../pipes/money.pipe';

const BUTTON = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
/** How many transfers the card lists. */
const LATEST_TRANSFERS = 5;
const INPUT = 'px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/** An existing account in the edit form. Names and balances are read from the form when saving. */
interface Draft {
  key: number;
  id: string;
  name: string;
  initialBalance: number;
  currency: Currency;
  removed: boolean;
}

@Component({
  selector: 'app-accounts-card',
  imports: [CurrencyPipe, DatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
      <div class="flex items-center justify-between gap-4 mb-4">
        <h2 id="accounts-heading" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Cuentas</h2>
        @if (!drafts() && !transferring() && !adding()) {
          <div class="flex gap-2">
            @if (accounts.hasSeveral()) {
              <button type="button" [class]="buttonClass" (click)="startTransfer()">Transferir</button>
            }
            <button type="button" [class]="buttonClass" (click)="startEditing()">Editar</button>
          </div>
        }
      </div>

      @if (drafts(); as rows) {
        <form (submit)="save($event)" class="space-y-3">
          <p class="text-sm text-gray-500 dark:text-gray-400">El saldo inicial es lo que tenía la cuenta antes de tu primer movimiento, en la moneda de la cuenta.</p>
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
                    [class]="inputClass + ' w-24 sm:w-28 text-right tabular-nums'"
                  />
                  <label [for]="'account-currency-' + row.key" class="sr-only">Moneda</label>
                  <select
                    [id]="'account-currency-' + row.key"
                    [name]="'currency-' + row.key"
                    [class]="inputClass + ' w-20'"
                  >
                    @for (option of currencies; track option.code) {
                      <option [value]="option.code" [selected]="option.code === row.currency">{{ option.code }}</option>
                    }
                  </select>
                  @if (row.id !== mainId) {
                    <button
                      type="button"
                      (click)="patch(row.key, { removed: true })"
                      class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                      [attr.aria-label]="'Eliminar ' + row.name"
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
            } @else if (accounts.usage(row.id) > 0) {
              @let count = accounts.usage(row.id);
              <p class="text-xs text-amber-600 dark:text-amber-400">
                Al guardar,
                {{ count === 1 ? 'el movimiento' : 'los ' + count + ' movimientos' }}
                de {{ accounts.getById(row.id)?.name }} {{ count === 1 ? 'pasará' : 'pasarán' }} a {{ mainName() }}.
              </p>
            }
          }
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" [class]="buttonClass" (click)="drafts.set(null)">Cancelar</button>
            <button type="submit" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Guardar</button>
          </div>
        </form>
      } @else if (adding()) {
        <form (submit)="saveNew($event)" class="space-y-3" aria-label="Nueva cuenta">
          <div>
            <label for="new-account-name" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nombre de la cuenta</label>
            <input id="new-account-name" name="name" required maxlength="40" placeholder="Ej: Efectivo" [class]="inputClass + ' w-full'" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="new-account-balance" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo inicial</label>
              <input id="new-account-balance" name="balance" type="number" inputmode="numeric" value="0" [class]="inputClass + ' w-full text-right tabular-nums'" />
            </div>
            <div>
              <label for="new-account-currency" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Moneda</label>
              <select id="new-account-currency" name="currency" [class]="inputClass + ' w-full'">
                @for (option of currencies; track option.code) {
                  <option [value]="option.code" [selected]="option.code === 'CLP'">{{ option.label }}</option>
                }
              </select>
            </div>
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500">El saldo inicial es lo que tenía la cuenta antes de tu primer movimiento.</p>
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" [class]="buttonClass" (click)="adding.set(false)">Cancelar</button>
            <button type="submit" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Crear cuenta</button>
          </div>
        </form>
      } @else if (transferring()) {
        <form (submit)="saveTransfer($event)" class="space-y-3" aria-label="Nueva transferencia">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="transfer-from" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Desde</label>
              <select id="transfer-from" name="from" [class]="inputClass + ' w-full'" (change)="transferFrom.set($any($event.target).value)">
                @for (account of accounts.accounts(); track account.id; let first = $first) {
                  <option [value]="account.id" [selected]="first">{{ account.name }}</option>
                }
              </select>
            </div>
            <div>
              <label for="transfer-to" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hacia</label>
              <select id="transfer-to" name="to" [class]="inputClass + ' w-full'" (change)="transferTo.set($any($event.target).value)">
                @for (account of accounts.accounts(); track account.id; let index = $index) {
                  <option [value]="account.id" [selected]="index === 1">{{ account.name }}</option>
                }
              </select>
            </div>
            <div>
              <label for="transfer-amount" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Monto{{ transferChangesCurrency() ? ' enviado (' + currencyOf(transferFrom()) + ')' : '' }}</label>
              <input id="transfer-amount" name="amount" type="number" min="0" step="any" inputmode="decimal" required [class]="inputClass + ' w-full text-right tabular-nums'" />
            </div>
            @if (transferChangesCurrency()) {
              <div>
                <label for="transfer-to-amount" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Monto recibido ({{ currencyOf(transferTo()) }})</label>
                <input id="transfer-to-amount" name="toAmount" type="number" min="0" step="any" inputmode="decimal" required [class]="inputClass + ' w-full text-right tabular-nums'" />
              </div>
            }
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
              <span class="text-right">
                <span class="block whitespace-nowrap font-medium tabular-nums" [class]="balanceClass(item.balance)">{{ item.balance | money:item.account.currency }}</span>
                @if (item.account.currency !== 'CLP' && rates.rate(item.account.currency) !== null) {
                  <span class="block whitespace-nowrap text-xs tabular-nums text-gray-400 dark:text-gray-500">≈ {{ item.balanceInClp | money }}</span>
                }
              </span>
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
        @if (accounts.hasForeignCurrency()) {
          <div class="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 text-xs text-gray-600 dark:text-gray-300" aria-label="Tipo de cambio" role="group">
            @if (editingRates()) {
              <form (submit)="saveRates($event)" class="space-y-2">
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label for="rate-usd" class="block mb-1">Dólar en pesos</label>
                    <input id="rate-usd" name="USD" type="number" min="0" step="any" inputmode="decimal" [value]="rates.rates().USD ?? ''" [class]="inputClass + ' w-full text-right tabular-nums'" />
                  </div>
                  <div>
                    <label for="rate-uf" class="block mb-1">UF en pesos</label>
                    <input id="rate-uf" name="UF" type="number" min="0" step="any" inputmode="decimal" [value]="rates.rates().UF ?? ''" [class]="inputClass + ' w-full text-right tabular-nums'" />
                  </div>
                </div>
                <div class="flex justify-end gap-2">
                  <button type="button" [class]="buttonClass" (click)="editingRates.set(false)">Cancelar</button>
                  <button type="submit" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Guardar valores</button>
                </div>
              </form>
            } @else {
              <p class="tabular-nums">
                Dólar {{ rates.rates().USD === null ? 'sin valor' : (rates.rates().USD! | money) }}
                · UF {{ rates.rates().UF === null ? 'sin valor' : (rates.rates().UF! | money) }}
              </p>
              @if (rates.rates().date) {
                <p class="mt-0.5 text-gray-400 dark:text-gray-500">
                  {{ rates.rates().source === 'manual' ? 'Escrito por ti' : 'Valor de mindicador.cl' }} el {{ rates.rates().date | date:'d MMM y' }}
                </p>
              }
              @if (accounts.missingRates().length > 0) {
                <p class="mt-1 text-amber-600 dark:text-amber-400">Sin el valor de {{ missingNames() }}, el total no incluye esas cuentas.</p>
              }
              @if (rates.error(); as error) {
                <p class="mt-1 text-red-600 dark:text-red-400" role="alert">{{ error }}</p>
              }
              <div class="mt-2 flex gap-2">
                <button type="button" [class]="buttonClass" (click)="rates.refresh(true)" [disabled]="rates.loading()">{{ rates.loading() ? 'Actualizando…' : 'Actualizar' }}</button>
                <button type="button" [class]="buttonClass" (click)="editingRates.set(true)">Escribir a mano</button>
              </div>
            }
          </div>
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
                  <span class="whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">
                    {{ transfer.amount | money:currencyOf(transfer.fromAccountId) }}
                    @if (accounts.changesCurrency(transfer.fromAccountId, transfer.toAccountId)) {
                      → {{ accounts.receivedAmount(transfer) | money:currencyOf(transfer.toAccountId) }}
                    }
                  </span>
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
  protected readonly rates = inject(ExchangeRateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly buttonClass = BUTTON;
  protected readonly inputClass = INPUT;
  protected readonly mainId = MAIN_ACCOUNT_ID;
  protected readonly currencies = CURRENCIES;
  protected readonly editingRates = signal(false);
  protected readonly transferFrom = signal('');
  protected readonly transferTo = signal('');
  protected readonly transferChangesCurrency = computed(() => this.accounts.changesCurrency(this.transferFrom(), this.transferTo()));
  protected readonly missingNames = computed(() =>
    this.accounts.missingRates().map(c => (c === 'USD' ? 'el dólar' : 'la UF')).join(' y ')
  );
  protected readonly drafts = signal<Draft[] | null>(null);
  protected readonly transferring = signal(false);
  protected readonly adding = signal(false);
  protected readonly transferError = signal<string | null>(null);
  protected readonly latestTransfers = computed(() => this.accounts.recentTransfers().slice(0, LATEST_TRANSFERS));
  protected readonly mainName = computed(() => this.accounts.getById(MAIN_ACCOUNT_ID)?.name ?? 'la cuenta principal');
  private nextKey = 0;

  protected today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  protected currencyOf(id: string): Currency {
    return this.accounts.getById(id)?.currency ?? 'CLP';
  }

  /** Opens the transfer form from the first account to the second, as its selects start. */
  protected startTransfer(): void {
    const [first, second] = this.accounts.accounts();
    this.transferFrom.set(first?.id ?? '');
    this.transferTo.set(second?.id ?? '');
    this.transferring.set(true);
  }

  protected saveRates(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const read = (key: string) => (data.get(key) === '' ? null : Number(data.get(key)));
    this.rates.setManual({ USD: read('USD'), UF: read('UF') });
    this.editingRates.set(false);
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
    const toAmount = data.has('toAmount') ? Number(data.get('toAmount')) : undefined;
    try {
      this.accounts.transfer({
        fromAccountId: String(data.get('from')),
        toAccountId: String(data.get('to')),
        amount,
        toAmount,
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
      key: this.nextKey++, id: a.id, name: a.name, initialBalance: a.initialBalance, currency: a.currency, removed: false,
    })));
  }

  /** Opens the form for a single new account, leaving the others untouched. */
  protected startAdding(): void {
    this.adding.set(true);
    // Focus the name field once it is rendered.
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLInputElement>('#new-account-name')?.focus(), { injector: this.injector });
  }

  protected saveNew(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const name = String(data.get('name') ?? '').trim();
    if (!name) return;
    const currency = data.get('currency');
    this.accounts.add({
      name,
      initialBalance: Number(data.get('balance')) || 0,
      currency: isCurrency(currency) ? currency : 'CLP',
    });
    this.adding.set(false);
    if (this.accounts.hasForeignCurrency()) void this.rates.refresh();
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
      currency: isCurrency(data.get(`currency-${row.key}`)) ? data.get(`currency-${row.key}`) as Currency : row.currency,
    }));
    if (values.some(v => !v.name)) return;

    for (const row of rows) {
      if (row.removed) this.accounts.remove(row.id);
    }
    for (const { row, name, initialBalance, currency } of values) {
      this.accounts.update(row.id, { name, initialBalance, currency });
    }
    this.drafts.set(null);
    if (this.accounts.hasForeignCurrency()) void this.rates.refresh();
  }
}
