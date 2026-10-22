import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { TransactionService } from '../../core/services/transaction.service';
import { TransactionFormComponent } from './transaction-form/transaction-form.component';
import { DataTransferPanelComponent } from '../../shared/components/data-transfer-panel/data-transfer-panel.component';
import { SampleDataBannerComponent } from '../../shared/components/sample-data-banner/sample-data-banner.component';
import { Transaction } from '../../core/models/transaction.model';

const UNDO_TIMEOUT_MS = 5000;

type FilterType = 'all' | 'income' | 'expense';

interface FilterOption {
  label: string;
  value: FilterType;
}

/** Lowercases and strips accents so "medico" matches "Médico". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

@Component({
  selector: 'app-transactions',
  imports: [CurrencyPipe, DatePipe, TransactionFormComponent, SampleDataBannerComponent, DataTransferPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-5xl mx-auto px-4 py-8" [class.pb-24]="lastRemoved()" id="main-content">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Transacciones</h1>
          <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">{{ filteredTransactions().length }} registros</p>
        </div>
        <button
          (click)="openNewForm()"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          aria-label="Agregar nueva transacción"
        >
          <span aria-hidden="true">+</span> Nueva
        </button>
      </div>

      <app-sample-data-banner />

      <div class="flex gap-2 mb-4" role="group" aria-label="Filtrar transacciones">
        @for (option of filterOptions; track option.value) {
          <button
            (click)="setTypeFilter(option.value)"
            [class]="activeFilter() === option.value
              ? 'px-4 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white dark:bg-indigo-600'
              : 'px-4 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'"
            [attr.aria-pressed]="activeFilter() === option.value"
          >
            {{ option.label }}
          </button>
        }
      </div>

      <div class="flex flex-col sm:flex-row gap-2 mb-6">
        <label for="search" class="sr-only">Buscar transacciones</label>
        <input
          id="search"
          type="search"
          placeholder="Buscar por descripción"
          [value]="searchTerm()"
          (input)="searchTerm.set($any($event.target).value)"
          class="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          autocomplete="off"
        />
        <label for="category-filter" class="sr-only">Filtrar por categoría</label>
        <select
          id="category-filter"
          [value]="categoryFilter()"
          (change)="categoryFilter.set($any($event.target).value)"
          class="sm:w-56 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Todas las categorías</option>
          @for (category of categoryOptions(); track category.id) {
            <option [value]="category.id" [selected]="category.id === categoryFilter()">{{ category.name }}</option>
          }
        </select>
      </div>

      <section aria-label="Lista de transacciones">
        <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          @if (!hasTransactions()) {
            <div class="py-16 px-6 text-center">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Aún no tienes transacciones.</p>
              <button
                type="button"
                (click)="openNewForm()"
                class="px-4 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Agregar primera transacción
              </button>
            </div>
          } @else if (filteredTransactions().length === 0) {
            <p class="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">
              {{ searchTerm() || categoryFilter() ? 'Ninguna transacción coincide con la búsqueda' : 'No hay transacciones de este tipo' }}
            </p>
          } @else {
            <ul>
              @for (transaction of filteredTransactions(); track transaction.id; let last = $last) {
                <li
                  [class]="'flex items-center justify-between px-6 py-4' + (!last ? ' border-b border-gray-50 dark:border-gray-800' : '')"
                >
                  <div class="flex items-center gap-3">
                    <span
                      class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      [style.background]="getCategoryColor(transaction.categoryId)"
                      aria-hidden="true"
                    ></span>
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ transaction.description }}</p>
                      <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {{ getCategoryName(transaction.categoryId) }} · {{ transaction.date | date:'dd MMM yyyy' }}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <span
                      class="text-sm font-semibold"
                      [class]="transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'"
                    >
                      {{ transaction.type === 'income' ? '+' : '-' }}{{ transaction.amount | currency:'$':'symbol':'1.0-0' }}
                    </span>
                    <button
                      (click)="openEditForm(transaction)"
                      class="p-1.5 text-gray-300 dark:text-gray-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors rounded"
                      [attr.aria-label]="'Editar ' + transaction.description"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      (click)="removeTransaction(transaction)"
                      class="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-400 transition-colors rounded"
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

      <app-data-transfer-panel />
    </main>

    @if (lastRemoved(); as removed) {
      <div
        class="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-30 flex items-center justify-between gap-4 px-4 py-3 rounded-xl shadow-lg bg-gray-900 text-white text-sm dark:bg-gray-800 dark:border dark:border-gray-700"
        role="status"
      >
        <span>Se eliminó «{{ removed.description }}»</span>
        <button
          type="button"
          (click)="undoRemove()"
          class="font-medium text-indigo-300 hover:text-indigo-200 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
        >
          Deshacer
        </button>
      </div>
    }

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
  private undoTimer: ReturnType<typeof setTimeout> | undefined;

  /** Last deleted transaction, kept while the "Deshacer" toast is visible. */
  protected readonly lastRemoved = signal<Transaction | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.undoTimer));
  }

  protected readonly activeFilter = signal<FilterType>('all');
  protected readonly showForm = signal(false);
  protected readonly editingTransaction = signal<Transaction | null>(null);

  protected readonly filterOptions: FilterOption[] = [
    { label: 'Todos',    value: 'all'     },
    { label: 'Ingresos', value: 'income'  },
    { label: 'Gastos',   value: 'expense' },
  ];

  protected readonly hasTransactions = computed(() => this.transactionService.transactions().length > 0);
  protected readonly searchTerm = signal('');
  protected readonly categoryFilter = signal('');

  protected readonly categoryOptions = computed(() => {
    const filter = this.activeFilter();
    const categories = this.transactionService.categories();
    return filter === 'all' ? categories : categories.filter(c => c.type === filter);
  });

  protected readonly filteredTransactions = computed(() => {
    const filter = this.activeFilter();
    const categoryId = this.categoryFilter();
    const term = normalize(this.searchTerm().trim());
    const filtered = this.transactionService.transactions().filter(t =>
      (filter === 'all' || t.type === filter) &&
      (!categoryId || t.categoryId === categoryId) &&
      (!term || normalize(t.description).includes(term))
    );
    // Most recent first; same-day transactions keep the order they were added in.
    return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  });

  protected setTypeFilter(filter: FilterType): void {
    this.activeFilter.set(filter);
    // Drop a category that no longer matches the selected type.
    if (!this.categoryOptions().some(c => c.id === this.categoryFilter())) {
      this.categoryFilter.set('');
    }
  }

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

  protected removeTransaction(transaction: Transaction): void {
    this.transactionService.remove(transaction.id);
    this.lastRemoved.set(transaction);
    clearTimeout(this.undoTimer);
    this.undoTimer = setTimeout(() => this.lastRemoved.set(null), UNDO_TIMEOUT_MS);
  }

  protected undoRemove(): void {
    const removed = this.lastRemoved();
    if (!removed) return;
    this.transactionService.restore(removed);
    this.lastRemoved.set(null);
    clearTimeout(this.undoTimer);
  }
}
