import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { TransactionService } from '../../core/services/transaction.service';

type FilterType = 'all' | 'income' | 'expense';

interface FilterOption {
  label: string;
  value: FilterType;
}

@Component({
  selector: 'app-transactions',
  imports: [CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-5xl mx-auto px-4 py-8" id="main-content">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">Transacciones</h1>
          <p class="text-gray-500 text-sm mt-1">{{ filteredTransactions().length }} registros</p>
        </div>
      </div>

      <div class="flex gap-2 mb-6" role="group" aria-label="Filtrar transacciones">
        @for (option of filterOptions; track option.value) {
          <button
            (click)="activeFilter.set(option.value)"
            [class]="activeFilter() === option.value
              ? 'px-4 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white'
              : 'px-4 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'"
            [attr.aria-pressed]="activeFilter() === option.value"
          >
            {{ option.label }}
          </button>
        }
      </div>

      <section aria-label="Lista de transacciones">
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          @if (filteredTransactions().length === 0) {
            <p class="py-16 text-center text-gray-400 text-sm">
              No hay transacciones
            </p>
          } @else {
            <ul>
              @for (transaction of filteredTransactions(); track transaction.id; let last = $last) {
                <li
                  [class]="'flex items-center justify-between px-6 py-4' + (!last ? ' border-b border-gray-50' : '')"
                >
                  <div class="flex items-center gap-3">
                    <span
                      class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      [style.background]="getCategoryColor(transaction.categoryId)"
                      aria-hidden="true"
                    ></span>
                    <div>
                      <p class="text-sm font-medium text-gray-900">{{ transaction.description }}</p>
                      <p class="text-xs text-gray-400 mt-0.5">
                        {{ getCategoryName(transaction.categoryId) }} · {{ transaction.date | date:'dd MMM yyyy' }}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-4">
                    <span
                      class="text-sm font-semibold"
                      [class]="transaction.type === 'income' ? 'text-emerald-600' : 'text-red-500'"
                    >
                      {{ transaction.type === 'income' ? '+' : '-' }}{{ transaction.amount | currency:'$':'symbol':'1.0-0' }}
                    </span>
                    <button
                      (click)="removeTransaction(transaction.id)"
                      class="text-gray-300 hover:text-red-400 text-lg leading-none transition-colors"
                      [attr.aria-label]="'Eliminar ' + transaction.description"
                    >
                      ×
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      </section>
    </main>
  `,
})
export class TransactionsComponent {
  private readonly transactionService = inject(TransactionService);

  protected readonly activeFilter = signal<FilterType>('all');

  protected readonly filterOptions: FilterOption[] = [
    { label: 'Todos',     value: 'all'     },
    { label: 'Ingresos',  value: 'income'  },
    { label: 'Gastos',    value: 'expense' },
  ];

  protected readonly filteredTransactions = computed(() => {
    const filter = this.activeFilter();
    const transactions = this.transactionService.transactions();
    if (filter === 'all') return transactions;
    return transactions.filter(t => t.type === filter);
  });

  protected getCategoryName(categoryId: string): string {
    return this.transactionService.getCategoryById(categoryId)?.name ?? '—';
  }

  protected getCategoryColor(categoryId: string): string {
    return this.transactionService.getCategoryById(categoryId)?.color ?? '#ccc';
  }

  protected removeTransaction(id: string): void {
    this.transactionService.remove(id);
  }
}
