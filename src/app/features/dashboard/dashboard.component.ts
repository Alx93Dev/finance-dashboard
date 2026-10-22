import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TransactionService, percentChange } from '../../core/services/transaction.service';
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

        <div class="flex items-center gap-1" role="group" aria-label="Seleccionar mes">
          <button
            type="button"
            (click)="tx.previousMonth()"
            class="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            aria-label="Mes anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <p class="min-w-36 text-center text-sm font-medium text-gray-900 dark:text-gray-100 capitalize" aria-live="polite">
            {{ tx.selectedMonth() + '-01' | date:'MMMM y' }}
          </p>
          <button
            type="button"
            (click)="tx.nextMonth()"
            class="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            aria-label="Mes siguiente"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

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
              No hay movimientos en este mes.
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

  protected change(current: number, previous: number): number | null {
    return this.tx.hasPreviousMonth() ? percentChange(current, previous) : null;
  }
}

