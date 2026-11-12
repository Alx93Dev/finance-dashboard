import { ChangeDetectionStrategy, Component, DOCUMENT, computed, inject, linkedSignal } from '@angular/core';
import { CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TransactionService } from '../../core/services/transaction.service';
import { compareYears, reportYears, yearReport } from '../../core/services/report';

const ARROW = 'p-2 rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
const CARD = 'bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm';

@Component({
  selector: 'app-reports',
  imports: [CurrencyPipe, DatePipe, PercentPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-5xl mx-auto px-4 py-8" id="main-content">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Reportes<span class="hidden print:inline"> {{ year() }}</span></h1>
        @if (years().length > 0) {
          <div class="flex items-center gap-2 print:hidden">
          <button type="button" (click)="exportPdf()" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 dark:text-gray-200 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clip-rule="evenodd" />
            </svg>
            Exportar PDF
          </button>
          <div class="flex items-center gap-1" role="group" aria-label="Seleccionar año">
            <button type="button" [class]="arrowClass" (click)="shiftYear(1)" [disabled]="!hasOlder()" aria-label="Año anterior">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
            <p class="min-w-16 text-center text-sm font-medium text-gray-900 dark:text-gray-100 tabular-nums" aria-live="polite">{{ year() }}</p>
            <button type="button" [class]="arrowClass" (click)="shiftYear(-1)" [disabled]="!hasNewer()" aria-label="Año siguiente">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          </div>
        }
      </div>

      @if (report(); as r) {
        <section aria-labelledby="year-heading" class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <h2 id="year-heading" class="sr-only">Totales de {{ r.year }}</h2>
          <div [class]="cardClass">
            <p class="text-xs text-gray-500 dark:text-gray-400">Ingresos</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{{ r.totals.income | currency:'$':'symbol':'1.0-0' }}</p>
            @if (comparison(); as c) {
              @if (trend(c.income, true); as tr) {
                <p class="mt-1 text-xs font-medium" [class]="tr.cls">{{ tr.text }} vs {{ c.previousYear }}</p>
              }
            }
          </div>
          <div [class]="cardClass">
            <p class="text-xs text-gray-500 dark:text-gray-400">Gastos</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-red-500 dark:text-red-400">{{ r.totals.expenses | currency:'$':'symbol':'1.0-0' }}</p>
            @if (comparison(); as c) {
              @if (trend(c.expenses, false); as tr) {
                <p class="mt-1 text-xs font-medium" [class]="tr.cls">{{ tr.text }} vs {{ c.previousYear }}</p>
              }
            }
          </div>
          <div [class]="cardClass">
            <p class="text-xs text-gray-500 dark:text-gray-400">Balance</p>
            <p class="mt-1 text-lg font-semibold tabular-nums" [class]="r.totals.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'">{{ r.totals.balance | currency:'$':'symbol':'1.0-0' }}</p>
            @if (comparison(); as c) {
              @if (trend(c.balance, true); as tr) {
                <p class="mt-1 text-xs font-medium" [class]="tr.cls">{{ tr.text }} vs {{ c.previousYear }}</p>
              }
            }
          </div>
          <div [class]="cardClass">
            <p class="text-xs text-gray-500 dark:text-gray-400">Tasa de ahorro</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ r.totals.savingsRate === null ? '—' : r.totals.savingsRate + '%' }}</p>
            @if (comparison(); as c) {
              @if (trend(c.savingsRatePoints, true, ' pts'); as tr) {
                <p class="mt-1 text-xs font-medium" [class]="tr.cls">{{ tr.text }} vs {{ c.previousYear }}</p>
              }
            }
          </div>
        </section>

        <section [class]="cardClass + ' mb-6'" aria-labelledby="months-heading">
          <h2 id="months-heading" class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Mes a mes</h2>
          <div class="overflow-x-auto -mx-5 px-5">
            <table class="w-full text-xs sm:text-sm">
              <thead>
                <tr class="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th scope="col" class="py-2 font-medium">Mes</th>
                  <th scope="col" class="py-2 font-medium text-right">Ingresos</th>
                  <th scope="col" class="py-2 font-medium text-right">Gastos</th>
                  <th scope="col" class="py-2 font-medium text-right">Balance</th>
                  <th scope="col" class="hidden sm:table-cell py-2 font-medium text-right">Ahorro</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800 tabular-nums">
                @for (row of r.months; track row.month) {
                  <tr [class]="row.income || row.expenses ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'">
                    <th scope="row" class="py-2 pr-2 text-left font-normal capitalize"><span class="sm:hidden">{{ row.month + '-01' | date:'MMM' }}</span><span class="hidden sm:inline">{{ row.month + '-01' | date:'MMMM' }}</span></th>
                    <td class="py-2 text-right">{{ row.income | currency:'$':'symbol':'1.0-0' }}</td>
                    <td class="py-2 text-right">{{ row.expenses | currency:'$':'symbol':'1.0-0' }}</td>
                    <td class="py-2 text-right" [class]="row.balance < 0 ? 'text-red-600 dark:text-red-400' : ''">{{ row.balance | currency:'$':'symbol':'1.0-0' }}</td>
                    <td class="hidden sm:table-cell py-2 text-right">{{ row.savingsRate === null ? '—' : row.savingsRate + '%' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <section [class]="cardClass" aria-labelledby="categories-heading">
            <h2 id="categories-heading" class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Gastos por categoría</h2>
            @if (r.expensesByCategory.length === 0) {
              <p class="text-sm text-gray-500 dark:text-gray-400">No hay gastos en {{ r.year }}.</p>
            } @else {
              <ul class="space-y-4">
                @for (row of r.expensesByCategory; track row.category.id) {
                  <li>
                    <div class="flex items-baseline justify-between gap-4 text-sm">
                      <span class="font-medium text-gray-900 dark:text-gray-100">{{ row.category.name }}</span>
                      <span class="whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">{{ row.total | currency:'$':'symbol':'1.0-0' }} · {{ row.share | percent:'1.0-0' }}</span>
                    </div>
                    <div class="mt-1.5 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" aria-hidden="true">
                      <div class="h-full rounded-full" [style.width.%]="row.share * 100" [style.background-color]="row.category.color"></div>
                    </div>
                    <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {{ row.monthlyAverage | currency:'$':'symbol':'1.0-0' }} al mes en promedio
                      @if (comparison(); as c) {
                        @if (trend(c.categories[row.category.id], false); as tr) {
                          · <span class="font-medium" [class]="tr.cls">{{ tr.text }} vs {{ c.previousYear }}</span>
                        } @else {
                          · sin gastos en {{ c.previousYear }}
                        }
                      }
                    </p>
                  </li>
                }
              </ul>
            }
          </section>

          <section [class]="cardClass" aria-labelledby="largest-heading">
            <h2 id="largest-heading" class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Gastos más grandes</h2>
            @if (r.largestExpenses.length === 0) {
              <p class="text-sm text-gray-500 dark:text-gray-400">No hay gastos en {{ r.year }}.</p>
            } @else {
              <ol class="divide-y divide-gray-100 dark:divide-gray-800">
                @for (t of r.largestExpenses; track t.id) {
                  <li class="flex items-baseline justify-between gap-4 py-2 text-sm">
                    <div class="min-w-0">
                      <p class="truncate text-gray-900 dark:text-gray-100">{{ t.description }}</p>
                      <p class="text-xs text-gray-400 dark:text-gray-500">{{ categoryName(t.categoryId) }} · {{ t.date | date:'d MMM' }}</p>
                    </div>
                    <span class="shrink-0 whitespace-nowrap tabular-nums font-medium text-red-500 dark:text-red-400">{{ t.amount | currency:'$':'symbol':'1.0-0' }}</span>
                  </li>
                }
              </ol>
            }
          </section>
        </div>
      } @else {
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Aún no tienes transacciones para armar un reporte.
          <a routerLink="/transactions" class="font-medium text-indigo-600 hover:underline dark:text-indigo-400">Agrega la primera</a>
        </p>
      }
    </main>
  `,
})
export class ReportsComponent {
  private readonly tx = inject(TransactionService);
  private readonly document = inject(DOCUMENT);

  protected readonly arrowClass = ARROW;
  protected readonly cardClass = CARD;

  protected readonly years = computed(() => reportYears(this.tx.transactions()));
  /** Selected year; starts at the most recent one with data. */
  protected readonly year = linkedSignal(() => this.years()[0] ?? new Date().getFullYear());
  private readonly yearIndex = computed(() => this.years().indexOf(this.year()));
  protected readonly hasOlder = computed(() => this.yearIndex() < this.years().length - 1);
  protected readonly hasNewer = computed(() => this.yearIndex() > 0);

  protected readonly report = computed(() =>
    this.years().length === 0 ? null : yearReport(this.tx.valuedTransactions(), this.tx.categories(), this.year())
  );

  /** The selected year against the one before it, when that year has transactions. */
  protected readonly comparison = computed(() => {
    const previous = this.year() - 1;
    if (!this.years().includes(previous)) return null;
    const transactions = this.tx.valuedTransactions();
    const categories = this.tx.categories();
    return compareYears(yearReport(transactions, categories, this.year()), yearReport(transactions, categories, previous));
  });

  /** Text and color for a change; null hides it. Rises are green unless `higherIsBetter` is false. */
  protected trend(value: number | null | undefined, higherIsBetter: boolean, unit = '%'): { text: string; cls: string } | null {
    if (value === null || value === undefined) return null;
    const arrow = value > 0 ? '▲ +' : value < 0 ? '▼ ' : '= ';
    const cls = value === 0
      ? 'text-gray-400 dark:text-gray-500'
      : value > 0 === higherIsBetter ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
    return { text: `${arrow}${value}${unit}`, cls };
  }

  /**
   * Opens the print dialog, where the report can be saved as PDF.
   * Prints in light mode, since a dark page wastes ink and reads badly on paper.
   */
  protected exportPdf(): void {
    const root = this.document.documentElement;
    const window = this.document.defaultView;
    if (!window) return;
    const wasDark = root.classList.contains('dark');
    if (wasDark) {
      root.classList.remove('dark');
      window.addEventListener('afterprint', () => root.classList.add('dark'), { once: true });
    }
    window.print();
  }

  /** Moves through the years that have data; +1 is older. */
  protected shiftYear(step: number): void {
    const next = this.years()[this.yearIndex() + step];
    if (next !== undefined) this.year.set(next);
  }

  protected categoryName(id: string): string {
    return this.tx.getCategoryById(id)?.name ?? 'Sin categoría';
  }
}
