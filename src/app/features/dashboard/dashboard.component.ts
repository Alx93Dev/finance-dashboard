import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TransactionService, percentChange } from '../../core/services/transaction.service';
import { AccountService } from '../../core/services/account.service';
import { SummaryCardComponent } from '../../shared/components/summary-card/summary-card.component';
import { DonutChartComponent } from '../../shared/components/charts/donut-chart.component';
import { BarChartComponent } from '../../shared/components/charts/bar-chart.component';
import { BalanceChartComponent } from '../../shared/components/charts/balance-chart.component';
import { BudgetsCardComponent } from '../../shared/components/budgets-card/budgets-card.component';
import { AccountsCardComponent } from '../../shared/components/accounts-card/accounts-card.component';
import { GoalsCardComponent } from '../../shared/components/goals-card/goals-card.component';
import { SampleDataBannerComponent } from '../../shared/components/sample-data-banner/sample-data-banner.component';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, SampleDataBannerComponent, SummaryCardComponent, DonutChartComponent, BarChartComponent, BalanceChartComponent, BudgetsCardComponent, GoalsCardComponent, AccountsCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-5xl mx-auto px-4 py-8" id="main-content">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Resumen</h1>

        <div class="flex flex-wrap items-center gap-2">
          @if (accounts.hasSeveral()) {
            <label for="dashboard-account" class="sr-only">Cuenta</label>
            <select
              id="dashboard-account"
              (change)="tx.dashboardAccount.set($any($event.target).value)"
              class="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="" [selected]="!selectedAccount()">Todas las cuentas</option>
              @for (account of accounts.accounts(); track account.id) {
                <option [value]="account.id" [selected]="account.id === selectedAccount()">{{ account.name }}</option>
              }
            </select>
          }

          <div class="flex items-center gap-1" role="group" aria-label="Seleccionar mes">
            <button
              type="button"
              (click)="tx.previousMonth()"
              class="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              [attr.aria-label]="tx.dashboardPeriod() ? 'Período anterior' : 'Mes anterior'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
            <p class="min-w-36 text-center text-sm font-medium text-gray-900 dark:text-gray-100" aria-live="polite">
              <span class="capitalize">{{ tx.selectedMonth() + '-01' | date:'MMMM y' }}</span>
              @if (tx.dashboardPeriod(); as period) {
                <span id="dashboard-period" class="block text-xs font-normal text-gray-500 dark:text-gray-400">
                  Facturación {{ period.start | date:'d MMM' }} – {{ period.end | date:'d MMM' }}
                </span>
                @if (period.due) {
                  <span id="dashboard-due" class="block text-xs font-normal text-gray-500 dark:text-gray-400">
                    Vence el {{ period.due | date:'d MMM' }}
                  </span>
                }
              }
            </p>
            <button
              type="button"
              (click)="tx.nextMonth()"
              class="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              [attr.aria-label]="tx.dashboardPeriod() ? 'Período siguiente' : 'Mes siguiente'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
            @if (tx.dashboardPeriod()) {
              <button
                type="button"
                (click)="editingPeriod.set(!editingPeriod()); periodError.set('')"
                [attr.aria-expanded]="editingPeriod()"
                aria-controls="period-editor"
                class="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                aria-label="Editar período de facturación"
                title="Editar período de facturación"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            }
          </div>
        </div>
      </div>

      @if (editingPeriod() && tx.dashboardPeriod(); as period) {
        <form
          id="period-editor"
          aria-labelledby="period-editor-heading"
          (submit)="savePeriod($event, period.month)"
          class="mb-6 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <h2 id="period-editor-heading" class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Período facturado de <span class="capitalize">{{ period.month + '-01' | date:'MMMM y' }}</span>
          </h2>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Usa las fechas que muestra tu banco. Cambiar el inicio también cambia el cierre del período anterior.
          </p>
          <div class="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label for="period-start" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Desde</label>
              <input id="period-start" name="start" type="date" required [value]="period.start" [class]="inputClass" />
            </div>
            <div>
              <label for="period-end" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hasta (cierre)</label>
              <input id="period-end" name="end" type="date" required [value]="period.end" [class]="inputClass" />
            </div>
            <div>
              <label for="period-due" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Vencimiento (opcional)</label>
              <input id="period-due" name="due" type="date" [value]="period.due ?? ''" [class]="inputClass" />
            </div>
            <div class="flex gap-2">
              <button type="submit" class="px-4 py-2 rounded-xl bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                Guardar período
              </button>
              <button type="button" (click)="editingPeriod.set(false)" class="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                Cancelar
              </button>
            </div>
          </div>
          @if (periodError()) {
            <p class="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">{{ periodError() }}</p>
          }
        </form>
      }

      <app-sample-data-banner />

      <section aria-labelledby="summary-heading" class="mb-6">
        <h2 id="summary-heading" class="sr-only">Resumen financiero</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <app-summary-card
            label="Ingresos"
            [amount]="tx.monthIncome()"
            [change]="change(tx.monthIncome(), tx.previousMonthIncome())"
            colorClass="text-emerald-600 dark:text-emerald-400"
          />
          <app-summary-card
            label="Gastos"
            [amount]="tx.monthExpenses()"
            [change]="change(tx.monthExpenses(), tx.previousMonthExpenses())"
            [higherIsBetter]="false"
            colorClass="text-red-500 dark:text-red-400"
          />
          <app-summary-card
            label="Balance"
            [amount]="tx.monthBalance()"
            [change]="change(tx.monthBalance(), tx.previousMonthBalance())"
            [colorClass]="tx.monthBalance() >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'"
          />
        </div>
        @if (tx.monthTransactions().length === 0) {
          <p class="mt-3 text-sm text-gray-400 dark:text-gray-500">
            @if (tx.transactions().length === 0) {
              Aún no tienes transacciones.
              <a routerLink="/transactions" class="font-medium text-indigo-600 hover:underline dark:text-indigo-400">Agrega la primera</a>
            } @else {
              No hay movimientos en {{ tx.dashboardPeriod() ? 'este período de facturación' : 'este mes' }}.
            }
          </p>
        }
      </section>

      <section aria-label="Gráficos" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <app-donut-chart />
        <app-bar-chart />
        <app-balance-chart class="md:col-span-2" />
      </section>

      <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <section aria-labelledby="accounts-heading">
          <app-accounts-card />
        </section>
        <section aria-labelledby="budgets-heading">
          <app-budgets-card />
        </section>
        <section aria-labelledby="goals-heading">
          <app-goals-card />
        </section>
      </div>
    </main>
  `,
})
export class DashboardComponent {
  protected readonly tx = inject(TransactionService);
  protected readonly accounts = inject(AccountService);
  /** The filtered account while it still exists; '' for all of them. */
  protected readonly selectedAccount = computed(() =>
    this.accounts.getById(this.tx.dashboardAccount()) ? this.tx.dashboardAccount() : ''
  );

  protected readonly inputClass =
    'px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:[color-scheme:dark]';
  /** Whether the form to change the shown billing period's dates is open. */
  protected readonly editingPeriod = signal(false);
  protected readonly periodError = signal('');

  /** Saves the dates typed for the billing period closing in a 'YYYY-MM' month. */
  protected savePeriod(event: Event, month: string): void {
    event.preventDefault();
    const accountId = this.selectedAccount();
    if (!accountId) return;
    const data = new FormData(event.target as HTMLFormElement);
    try {
      this.accounts.setPeriod(accountId, month, {
        start: String(data.get('start') ?? ''),
        end: String(data.get('end') ?? ''),
        due: String(data.get('due') ?? ''),
      });
      this.periodError.set('');
      this.editingPeriod.set(false);
    } catch (error) {
      this.periodError.set(error instanceof Error ? error.message : 'No se pudo guardar el período.');
    }
  }

  protected change(current: number, previous: number): number | null {
    return this.tx.hasPreviousMonth() ? percentChange(current, previous) : null;
  }
}

