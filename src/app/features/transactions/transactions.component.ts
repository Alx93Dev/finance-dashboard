import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { TransactionService } from '../../core/services/transaction.service';
import { TransactionFormComponent } from './transaction-form/transaction-form.component';
import { Transaction } from '../../core/models/transaction.model';

type FilterType = 'all' | 'income' | 'expense';

interface FilterOption {
  label: string;
  value: FilterType;
}

@Component({
  selector: 'app-transactions',
  imports: [CurrencyPipe, DatePipe, TransactionFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-5xl mx-auto px-4 py-8" id="main-content">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">Transacciones</h1>
          <p class="text-gray-500 text-sm mt-1">{{ filteredTransactions().length }} registros</p>
        </div>
        <button
          (click)="openNewForm()"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          aria-label="Agregar nueva transacción"
        >
          <span aria-hidden="true">+</span> Nueva
        </button>
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

                  <div class="flex items-center gap-2">
                    <span
                      class="text-sm font-semibold"
                      [class]="transaction.type === 'income' ? 'text-emerald-600' : 'text-red-500'"
                    >
                      {{ transaction.type === 'income' ? '+' : '-' }}{{ transaction.amount | currency:'$':'symbol':'1.0-0' }}
                    </span>
                    <button
                      (click)="openEditForm(transaction)"
                      class="p-1.5 text-gray-300 hover:text-indigo-500 transition-colors rounded"
                      [attr.aria-label]="'Editar ' + transaction.description"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      (click)="removeTransaction(transaction.id)"
                      class="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded"
                      [attr.aria-label]="'Eliminar ' + transaction.description"
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
        </div>
      </section>
    </main>

    @if (showForm()) {
      <app-transaction-form
        [editingTransaction]="editingTransaction()"
        (saved)="onFormSaved()"
        (cancelled)="closeForm()"
      />
    }
  `,
})
export class TransactionsComponent {
  private readonly transactionService = inject(TransactionService);

  protected readonly activeFilter = signal<FilterType>('all');
  protected readonly showForm = signal(false);
  protected readonly editingTransaction = signal<Transaction | null>(null);

  protected readonly filterOptions: FilterOption[] = [
    { label: 'Todos',    value: 'all'     },
    { label: 'Ingresos', value: 'income'  },
    { label: 'Gastos',   value: 'expense' },
  ];

  protected readonly filteredTransactions = computed(() => {
    const filter = this.activeFilter();
    const transactions = this.transactionService.transactions();
    if (filter === 'all') return transactions;
    return transactions.filter(t => t.type === filter);
  });

  protected openNewForm(): void {
    this.editingTransaction.set(null);
    this.showForm.set(true);
  }

  protected openEditForm(transaction: Transaction): void {
    this.editingTransaction.set(transaction);
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
    this.editingTransaction.set(null);
  }

  protected onFormSaved(): void {
    this.closeForm();
  }

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
