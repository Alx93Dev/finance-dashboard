import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Transaction } from '../../../core/models/transaction.model';
import { TransactionService } from '../../../core/services/transaction.service';

@Component({
  selector: 'app-transaction-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="'form-title'"
      (click)="onBackdropClick($event)"
    >
      <div
        class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between mb-6">
          <h2 id="form-title" class="text-lg font-semibold text-gray-900">
            {{ isEditing() ? 'Editar transacción' : 'Nueva transacción' }}
          </h2>
          <button
            type="button"
            (click)="cancelled.emit()"
            class="text-gray-400 hover:text-gray-600 transition-colors rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            aria-label="Cerrar formulario"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <!-- Tipo -->
          <fieldset class="mb-4">
            <legend class="block text-sm font-medium text-gray-700 mb-2">Tipo</legend>
            <div class="flex gap-2" role="group">
              <button
                type="button"
                (click)="setType('income')"
                [class]="form.get('type')?.value === 'income'
                  ? 'flex-1 py-2 rounded-xl text-sm font-medium bg-emerald-500 text-white'
                  : 'flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200'"
                [attr.aria-pressed]="form.get('type')?.value === 'income'"
              >
                Ingreso
              </button>
              <button
                type="button"
                (click)="setType('expense')"
                [class]="form.get('type')?.value === 'expense'
                  ? 'flex-1 py-2 rounded-xl text-sm font-medium bg-red-500 text-white'
                  : 'flex-1 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200'"
                [attr.aria-pressed]="form.get('type')?.value === 'expense'"
              >
                Gasto
              </button>
            </div>
          </fieldset>

          <!-- Descripción -->
          <div class="mb-4">
            <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <input
              id="description"
              type="text"
              formControlName="description"
              placeholder="Ej: Supermercado"
              class="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              [class]="descriptionInvalid()
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200 bg-white'"
              autocomplete="off"
            />
            @if (descriptionInvalid()) {
              <p class="mt-1 text-xs text-red-500" role="alert">La descripción es requerida</p>
            }
          </div>

          <!-- Monto -->
          <div class="mb-4">
            <label for="amount" class="block text-sm font-medium text-gray-700 mb-1">
              Monto
            </label>
            <input
              id="amount"
              type="number"
              formControlName="amount"
              placeholder="0"
              min="1"
              class="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              [class]="amountInvalid()
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200 bg-white'"
            />
            @if (amountInvalid()) {
              <p class="mt-1 text-xs text-red-500" role="alert">Ingresa un monto mayor a 0</p>
            }
          </div>

          <!-- Categoría -->
          <div class="mb-4">
            <label for="categoryId" class="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              id="categoryId"
              formControlName="categoryId"
              class="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              [class]="categoryInvalid()
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200 bg-white'"
            >
              <option value="" disabled>Selecciona una categoría</option>
              @for (category of filteredCategories(); track category.id) {
                <option [value]="category.id">{{ category.name }}</option>
              }
            </select>
            @if (categoryInvalid()) {
              <p class="mt-1 text-xs text-red-500" role="alert">Selecciona una categoría</p>
            }
          </div>

          <!-- Fecha -->
          <div class="mb-6">
            <label for="date" class="block text-sm font-medium text-gray-700 mb-1">
              Fecha
            </label>
            <input
              id="date"
              type="date"
              formControlName="date"
              class="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              [class]="dateInvalid()
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200 bg-white'"
            />
            @if (dateInvalid()) {
              <p class="mt-1 text-xs text-red-500" role="alert">La fecha es requerida</p>
            }
          </div>

          <!-- Acciones -->
          <div class="flex gap-3">
            <button
              type="button"
              (click)="cancelled.emit()"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              class="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              [disabled]="form.invalid"
            >
              {{ isEditing() ? 'Guardar cambios' : 'Agregar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class TransactionFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly transactionService = inject(TransactionService);

  readonly editingTransaction = input<Transaction | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly isEditing = computed(() => this.editingTransaction() !== null);

  protected readonly filteredCategories = computed(() => {
    const type = this.form.get('type')?.value as 'income' | 'expense' | null;
    if (!type) return this.transactionService.categories();
    return this.transactionService.categories().filter(c => c.type === type);
  });

  protected readonly form = this.fb.nonNullable.group({
    type:        ['expense' as 'income' | 'expense', Validators.required],
    description: ['', [Validators.required, Validators.minLength(1)]],
    amount:      [null as unknown as number, [Validators.required, Validators.min(1)]],
    categoryId:  ['', Validators.required],
    date:        ['', Validators.required],
  });

  ngOnInit(): void {
    const transaction = this.editingTransaction();
    if (transaction) {
      this.form.setValue({
        type:        transaction.type,
        description: transaction.description,
        amount:      transaction.amount,
        categoryId:  transaction.categoryId,
        date:        transaction.date,
      });
    }

    this.form.get('type')!.valueChanges.subscribe(() => {
      this.form.patchValue({ categoryId: '' });
    });
  }

  protected setType(type: 'income' | 'expense'): void {
    this.form.patchValue({ type, categoryId: '' });
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;

    const { type, description, amount, categoryId, date } = this.form.getRawValue();
    const editingTransaction = this.editingTransaction();

    if (editingTransaction) {
      this.transactionService.update({ ...editingTransaction, type, description, amount, categoryId, date });
    } else {
      this.transactionService.add({ type, description, amount, categoryId, date });
    }

    this.saved.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancelled.emit();
    }
  }

  protected descriptionInvalid(): boolean {
    const control = this.form.get('description');
    return !!(control?.invalid && control.touched);
  }

  protected amountInvalid(): boolean {
    const control = this.form.get('amount');
    return !!(control?.invalid && control.touched);
  }

  protected categoryInvalid(): boolean {
    const control = this.form.get('categoryId');
    return !!(control?.invalid && control.touched);
  }

  protected dateInvalid(): boolean {
    const control = this.form.get('date');
    return !!(control?.invalid && control.touched);
  }
}
