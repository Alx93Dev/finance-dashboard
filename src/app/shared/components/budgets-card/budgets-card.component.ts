import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { BudgetService, BudgetStatus } from '../../../core/services/budget.service';
import { TransactionService } from '../../../core/services/transaction.service';

const BAR_CLASS: Record<BudgetStatus, string> = {
  ok: 'bg-emerald-500',
  warning: 'bg-amber-500',
  over: 'bg-red-500',
};

const TEXT_CLASS: Record<BudgetStatus, string> = {
  ok: 'text-gray-500 dark:text-gray-400',
  warning: 'text-amber-600 dark:text-amber-400',
  over: 'text-red-600 dark:text-red-400',
};

const BUTTON = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

@Component({
  selector: 'app-budgets-card',
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
      <div class="flex items-center justify-between gap-4 mb-4">
        <h2 id="budgets-heading" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Presupuestos del mes</h2>
        @if (!editing() && budgets.monthProgress().length > 0) {
          <button type="button" [class]="buttonClass" (click)="startEditing()">Editar</button>
        }
      </div>

      @if (editing()) {
        <form (submit)="save($event)" class="space-y-3">
          <p class="text-sm text-gray-500 dark:text-gray-400">Límite mensual por categoría. Déjalo vacío para no tener presupuesto.</p>
          @for (category of expenseCategories(); track category.id) {
            <div class="flex items-center justify-between gap-4">
              <label [for]="'budget-' + category.id" class="text-sm text-gray-700 dark:text-gray-300">{{ category.name }}</label>
              <input
                [id]="'budget-' + category.id"
                [name]="category.id"
                type="number"
                min="0"
                step="1000"
                inputmode="numeric"
                placeholder="Sin límite"
                [value]="budgets.limitFor(category.id) ?? ''"
                class="w-40 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          }
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" [class]="buttonClass" (click)="editing.set(false)">Cancelar</button>
            <button type="submit" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Guardar</button>
          </div>
        </form>
      } @else if (budgets.monthProgress().length === 0) {
        <p class="text-sm text-gray-500 dark:text-gray-400">Define un límite mensual por categoría y sigue cuánto llevas gastado.</p>
        <button type="button" [class]="buttonClass + ' mt-3'" (click)="startEditing()">Definir presupuestos</button>
      } @else {
        <ul class="space-y-4" aria-labelledby="budgets-heading">
          @for (item of budgets.monthProgress(); track item.category.id) {
            <li>
              <div class="flex items-baseline justify-between gap-4 text-sm">
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ item.category.name }}</span>
                <span class="tabular-nums" [class]="textClass[item.status]">
                  {{ item.spent | currency:'$':'symbol':'1.0-0' }} de {{ item.limit | currency:'$':'symbol':'1.0-0' }}
                </span>
              </div>
              <div
                class="mt-1.5 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
                role="progressbar"
                [attr.aria-label]="'Presupuesto de ' + item.category.name"
                aria-valuemin="0"
                [attr.aria-valuemax]="item.limit"
                [attr.aria-valuenow]="item.spent"
              >
                <div class="h-full rounded-full transition-all" [class]="barClass[item.status]" [style.width.%]="barWidth(item.ratio)"></div>
              </div>
              @if (item.status === 'over') {
                <p class="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                  Te pasaste por {{ item.spent - item.limit | currency:'$':'symbol':'1.0-0' }}
                </p>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class BudgetsCardComponent {
  protected readonly budgets = inject(BudgetService);
  private readonly tx = inject(TransactionService);

  protected readonly buttonClass = BUTTON;
  protected readonly barClass = BAR_CLASS;
  protected readonly textClass = TEXT_CLASS;
  protected readonly editing = signal(false);
  protected readonly expenseCategories = computed(() =>
    this.tx.categories().filter(c => c.type === 'expense')
  );

  protected barWidth(ratio: number): number {
    return Math.min(ratio, 1) * 100;
  }

  protected startEditing(): void {
    this.editing.set(true);
  }

  protected save(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    for (const category of this.expenseCategories()) {
      const value = String(data.get(category.id) ?? '').trim();
      this.budgets.setLimit(category.id, value === '' ? null : Number(value));
    }
    this.editing.set(false);
  }
}
