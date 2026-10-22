import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MoneyPipe } from '../../pipes/money.pipe';
import { AccountService } from '../../../core/services/account.service';
import { TransactionService } from '../../../core/services/transaction.service';
import {
  ColumnMapping,
  NO_COLUMN,
  detectColumns,
  findHeaderRow,
  isSameMovement,
  parseCsv,
  readStatement,
} from '../../../core/services/statement-import';

const BUTTON = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
const SELECT = 'w-full px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
const PREVIEW_ROWS = 5;

type AmountMode = 'signed' | 'split';

@Component({
  selector: 'app-statement-import',
  imports: [DatePipe, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mt-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700" aria-labelledby="statement-title">
      <h3 id="statement-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Importar cartola</h3>

      @if (header().length === 0) {
        <p class="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">El archivo no tiene filas para importar.</p>
        <div class="mt-3"><button type="button" [class]="buttonClass" (click)="closed.emit()">Cerrar</button></div>
      } @else {
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Revisa qué columna es cada dato. Las detectamos automáticamente.</p>

        <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="statement-date" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha</label>
            <select id="statement-date" [class]="selectClass" (change)="setColumn('date', $event)">
              @for (name of header(); track $index) {
                <option [value]="$index" [selected]="$index === mapping().date">{{ name || 'Columna ' + ($index + 1) }}</option>
              }
            </select>
          </div>
          <div>
            <label for="statement-description" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Descripción</label>
            <select id="statement-description" [class]="selectClass" (change)="setColumn('description', $event)">
              <option [value]="noColumn" [selected]="mapping().description === noColumn">(ninguna)</option>
              @for (name of header(); track $index) {
                <option [value]="$index" [selected]="$index === mapping().description">{{ name || 'Columna ' + ($index + 1) }}</option>
              }
            </select>
          </div>
          <div>
            <label for="statement-mode" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Montos</label>
            <select id="statement-mode" [class]="selectClass" (change)="setMode($any($event.target).value)">
              <option value="signed" [selected]="mode() === 'signed'">Una columna (negativo = gasto)</option>
              <option value="split" [selected]="mode() === 'split'">Columnas de cargo y abono</option>
            </select>
          </div>
          @if (mode() === 'signed') {
            <div>
              <label for="statement-amount" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Monto</label>
              <select id="statement-amount" [class]="selectClass" (change)="setColumn('amount', $event)">
                @for (name of header(); track $index) {
                  <option [value]="$index" [selected]="$index === mapping().amount">{{ name || 'Columna ' + ($index + 1) }}</option>
                }
              </select>
            </div>
          } @else {
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="statement-debit" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cargos (gastos)</label>
                <select id="statement-debit" [class]="selectClass" (change)="setColumn('debit', $event)">
                  @for (name of header(); track $index) {
                    <option [value]="$index" [selected]="$index === mapping().debit">{{ name || 'Columna ' + ($index + 1) }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="statement-credit" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Abonos (ingresos)</label>
                <select id="statement-credit" [class]="selectClass" (change)="setColumn('credit', $event)">
                  @for (name of header(); track $index) {
                    <option [value]="$index" [selected]="$index === mapping().credit">{{ name || 'Columna ' + ($index + 1) }}</option>
                  }
                </select>
              </div>
            </div>
          }
          @if (accounts.hasSeveral()) {
            <div>
              <label for="statement-account" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cuenta</label>
              <select id="statement-account" [class]="selectClass" (change)="accountId.set($any($event.target).value)">
                @for (account of accounts.accounts(); track account.id) {
                  <option [value]="account.id" [selected]="account.id === accountId()">{{ account.name }}</option>
                }
              </select>
            </div>
          }
          <div>
            <label for="statement-expense-category" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Categoría de los gastos</label>
            <select id="statement-expense-category" [class]="selectClass" (change)="expenseCategory.set($any($event.target).value)">
              @for (category of expenseCategories(); track category.id) {
                <option [value]="category.id" [selected]="category.id === expenseCategory()">{{ category.name }}</option>
              }
            </select>
          </div>
          <div>
            <label for="statement-income-category" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Categoría de los ingresos</label>
            <select id="statement-income-category" [class]="selectClass" (change)="incomeCategory.set($any($event.target).value)">
              @for (category of incomeCategories(); track category.id) {
                <option [value]="category.id" [selected]="category.id === incomeCategory()">{{ category.name }}</option>
              }
            </select>
          </div>
        </div>

        <p class="mt-3 text-sm text-gray-700 dark:text-gray-300" role="status">
          {{ newRows().length }} {{ newRows().length === 1 ? 'movimiento nuevo' : 'movimientos nuevos' }}
          @if (duplicates() > 0) { · {{ duplicates() }} {{ duplicates() === 1 ? 'ya estaba registrado' : 'ya estaban registrados' }} }
          @if (statement().skipped > 0) { · {{ statement().skipped }} {{ statement().skipped === 1 ? 'fila no se pudo leer' : 'filas no se pudieron leer' }} }
        </p>

        @if (newRows().length > 0) {
          <ul class="mt-2 divide-y divide-gray-100 dark:divide-gray-800 text-sm" aria-label="Vista previa">
            @for (row of newRows().slice(0, previewRows); track $index) {
              <li class="flex items-baseline justify-between gap-3 py-1.5">
                <span class="min-w-0 truncate text-gray-700 dark:text-gray-300">
                  <span class="text-gray-400 dark:text-gray-500 tabular-nums">{{ row.date | date:'dd/MM/yy' }}</span> {{ row.description }}
                </span>
                <span class="shrink-0 whitespace-nowrap tabular-nums font-medium" [class]="row.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'">
                  {{ row.type === 'income' ? '+' : '-' }}{{ row.amount | money:(accounts.getById(accountId())?.currency ?? 'CLP') }}
                </span>
              </li>
            }
          </ul>
          @if (newRows().length > previewRows) {
            <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">y {{ newRows().length - previewRows }} más</p>
          }
        }

        <div class="mt-3 flex gap-2">
          <button type="button" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" [disabled]="newRows().length === 0" (click)="import()">
            Importar {{ newRows().length }}
          </button>
          <button type="button" [class]="buttonClass" (click)="closed.emit()">Cancelar</button>
        </div>
      }
    </section>
  `,
})
export class StatementImportComponent {
  private readonly tx = inject(TransactionService);
  protected readonly accounts = inject(AccountService);

  /** Text of the CSV file to import. */
  readonly text = input.required<string>();
  /** Emits how many transactions were added. */
  readonly imported = output<number>();
  readonly closed = output<void>();

  protected readonly buttonClass = BUTTON;
  protected readonly selectClass = SELECT;
  protected readonly noColumn = NO_COLUMN;
  protected readonly previewRows = PREVIEW_ROWS;

  private readonly table = computed(() => {
    const rows = parseCsv(this.text());
    const headerIndex = findHeaderRow(rows);
    return { header: rows[headerIndex] ?? [], data: rows.slice(headerIndex + 1) };
  });
  protected readonly header = computed(() => this.table().header);

  protected readonly mapping = signal<ColumnMapping>({ date: 0, description: NO_COLUMN, amount: NO_COLUMN, debit: NO_COLUMN, credit: NO_COLUMN });
  protected readonly mode = signal<AmountMode>('signed');
  protected readonly accountId = signal(this.accounts.defaultId());

  protected readonly expenseCategories = computed(() => this.tx.categories().filter(c => c.type === 'expense'));
  protected readonly incomeCategories = computed(() => this.tx.categories().filter(c => c.type === 'income'));
  // "Otros"-style catch-all categories are usually last.
  protected readonly expenseCategory = signal(this.expenseCategories().at(-1)?.id ?? '');
  protected readonly incomeCategory = signal(this.incomeCategories().at(-1)?.id ?? '');

  protected readonly statement = computed(() => {
    const mapping = this.mapping();
    const effective = this.mode() === 'signed'
      ? { ...mapping, debit: NO_COLUMN, credit: NO_COLUMN }
      : { ...mapping, amount: NO_COLUMN };
    return readStatement(this.table().data, effective);
  });

  private readonly split = computed(() => {
    const accountId = this.accountId();
    const existing = this.tx.transactions().filter(t => t.accountId === accountId);
    const fresh = this.statement().rows.filter(row => !existing.some(t => isSameMovement(t, row)));
    return { fresh, duplicates: this.statement().rows.length - fresh.length };
  });
  protected readonly newRows = computed(() => this.split().fresh);
  protected readonly duplicates = computed(() => this.split().duplicates);

  constructor() {
    // Start from the columns we can recognize every time a new file arrives.
    effect(() => {
      const header = this.header();
      const detected = detectColumns(header);
      const useSplit = detected.amount === NO_COLUMN && (detected.debit !== NO_COLUMN || detected.credit !== NO_COLUMN);
      const fallback = (index: number, other: number) => (index === NO_COLUMN ? other : index);
      this.mode.set(useSplit ? 'split' : 'signed');
      this.mapping.set({
        date: fallback(detected.date, 0),
        description: detected.description,
        amount: fallback(detected.amount, Math.min(1, header.length - 1)),
        debit: fallback(detected.debit, 0),
        credit: fallback(detected.credit, 0),
      });
    });
  }

  protected setColumn(field: keyof ColumnMapping, event: Event): void {
    const index = Number((event.target as HTMLSelectElement).value);
    this.mapping.update(mapping => ({ ...mapping, [field]: index }));
  }

  protected setMode(mode: AmountMode): void {
    this.mode.set(mode);
  }

  protected import(): void {
    const rows = this.newRows();
    for (const row of rows) {
      this.tx.add({
        ...row,
        categoryId: row.type === 'income' ? this.incomeCategory() : this.expenseCategory(),
        accountId: this.accountId(),
      });
    }
    this.imported.emit(rows.length);
  }
}
