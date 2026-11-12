import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MoneyPipe } from '../../pipes/money.pipe';
import { AccountService } from '../../../core/services/account.service';
import { TransactionService } from '../../../core/services/transaction.service';
import { Category, CategoryType, unusedColor } from '../../../core/models/category.model';
import {
  ColumnMapping,
  NO_COLUMN,
  StatementRow,
  detectColumns,
  findHeaderRow,
  hasOnlyPositiveAmounts,
  isSameMovement,
  isSameTransfer,
  looksLikeCreditCard,
  OwnTransferKind,
  ownTransferKind,
  normalize,
  readStatement,
} from '../../../core/services/statement-import';

const categoryKey = (type: CategoryType, name: string) => `${type}:${normalize(name).replace(/\s+/g, ' ').trim()}`;

const BUTTON = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
const SELECT = 'w-full px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
const PREVIEW_ROWS = 5;

type AmountMode = 'signed' | 'split' | 'balance';

const TRANSFER_KINDS: { kind: OwnTransferKind; one: string; many: string }[] = [
  { kind: 'card', one: 'movimiento parece pago de tarjeta', many: 'movimientos parecen pagos de tarjeta' },
  { kind: 'own', one: 'movimiento parece traspaso entre tus cuentas', many: 'movimientos parecen traspasos entre tus cuentas' },
];

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
            <label for="statement-category" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Categoría</label>
            <select id="statement-category" [class]="selectClass" (change)="setColumn('category', $event)">
              <option [value]="noColumn" [selected]="mapping().category === noColumn">(ninguna)</option>
              @for (name of header(); track $index) {
                <option [value]="$index" [selected]="$index === mapping().category">{{ name || 'Columna ' + ($index + 1) }}</option>
              }
            </select>
          </div>
          <div>
            <label for="statement-mode" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Montos</label>
            <select id="statement-mode" [class]="selectClass" (change)="setMode($any($event.target).value)">
              <option value="signed" [selected]="mode() === 'signed'">Una columna (negativo = gasto)</option>
              <option value="split" [selected]="mode() === 'split'">Columnas de cargo y abono</option>
              <option value="balance" [selected]="mode() === 'balance'">Monto sin signo y columna de saldo</option>
            </select>
          </div>
          @if (mode() !== 'split') {
            <div>
              <label for="statement-amount" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Monto</label>
              <select id="statement-amount" [class]="selectClass" (change)="setColumn('amount', $event)">
                @for (name of header(); track $index) {
                  <option [value]="$index" [selected]="$index === mapping().amount">{{ name || 'Columna ' + ($index + 1) }}</option>
                }
              </select>
            </div>
          }
          @if (mode() === 'balance') {
            <div>
              <label for="statement-balance" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Saldo</label>
              <select id="statement-balance" [class]="selectClass" (change)="setColumn('balance', $event)">
                @for (name of header(); track $index) {
                  <option [value]="$index" [selected]="$index === mapping().balance">{{ name || 'Columna ' + ($index + 1) }}</option>
                }
              </select>
            </div>
          }
          @if (mode() === 'signed') {
            <label class="flex items-center gap-2 self-end pb-1.5 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900" [checked]="positiveIsExpense()" (change)="positiveIsExpense.set($any($event.target).checked)" />
              Positivo = gasto (tarjeta de crédito)
            </label>
          }
          @if (mode() === 'split') {
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
            <label for="statement-expense-category" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ hasCategoryColumn() ? 'Gastos sin categoría' : 'Categoría de los gastos' }}</label>
            <select id="statement-expense-category" [class]="selectClass" (change)="expenseCategory.set($any($event.target).value)">
              @for (category of expenseCategories(); track category.id) {
                <option [value]="category.id" [selected]="category.id === expenseCategory()">{{ category.name }}</option>
              }
            </select>
          </div>
          <div>
            <label for="statement-income-category" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">{{ hasCategoryColumn() ? 'Ingresos sin categoría' : 'Categoría de los ingresos' }}</label>
            <select id="statement-income-category" [class]="selectClass" (change)="incomeCategory.set($any($event.target).value)">
              @for (category of incomeCategories(); track category.id) {
                <option [value]="category.id" [selected]="category.id === incomeCategory()">{{ category.name }}</option>
              }
            </select>
          </div>
          <div>
            <label for="statement-from" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Importar desde</label>
            <input id="statement-from" type="date" [class]="selectClass" [value]="fromDate()" (change)="fromDate.set($any($event.target).value)" />
            @if (lastDate(); as last) {
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Tu último movimiento en esta cuenta es del {{ last | date:'dd/MM/yy' }}.
                @if (fromDate() !== dayAfter(last)) {
                  <button type="button" class="underline hover:text-gray-700 dark:hover:text-gray-200" (click)="fromDate.set(dayAfter(last))">Importar solo lo posterior</button>
                }
              </p>
            }
          </div>
        </div>

        <p class="mt-3 text-sm text-gray-700 dark:text-gray-300" role="status">
          {{ newRows().length }} {{ newRows().length === 1 ? 'movimiento nuevo' : 'movimientos nuevos' }}
          @if (beforeFrom() > 0) { · {{ beforeFrom() }} {{ beforeFrom() === 1 ? 'es anterior' : 'son anteriores' }} a la fecha elegida }
          @if (duplicates() > 0) { · {{ duplicates() }} {{ duplicates() === 1 ? 'ya estaba registrado' : 'ya estaban registrados' }} }
          @if (statement().skipped > 0) { · {{ statement().skipped }} {{ statement().skipped === 1 ? 'fila no se pudo leer' : 'filas no se pudieron leer' }} }
        </p>
        @for (group of transferGroups(); track group.kind) {
          <div class="mt-2">
            <label [for]="'statement-transfer-' + group.kind" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              {{ group.rows.length }} {{ group.rows.length === 1 ? group.one : group.many }}. Registrarlos como transferencia con:
            </label>
            <select [id]="'statement-transfer-' + group.kind" [class]="selectClass" (change)="setTransferAccount(group.kind, $event)">
              <option value="" [selected]="group.target === ''">(no, dejarlos como gasto o ingreso)</option>
              @for (account of transferTargets(); track account.id) {
                <option [value]="account.id" [selected]="account.id === group.target">{{ account.name }}</option>
              }
            </select>
            @if (group.target && group.rows.length > group.transfers.length) {
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ group.rows.length - group.transfers.length }} ya {{ group.rows.length - group.transfers.length === 1 ? 'estaba registrado' : 'estaban registrados' }} como transferencia desde la otra cuenta.
              </p>
            }
          </div>
        }
        @if (missingCategories().length > 0) {
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Se crearán estas categorías: {{ missingCategoryNames() }}.</p>
        }

        @if (newRows().length > 0) {
          <ul class="mt-2 divide-y divide-gray-100 dark:divide-gray-800 text-sm" aria-label="Vista previa">
            @for (row of newRows().slice(0, previewRows); track $index) {
              <li class="flex items-baseline justify-between gap-3 py-1.5">
                <span class="min-w-0 truncate text-gray-700 dark:text-gray-300">
                  <span class="text-gray-400 dark:text-gray-500 tabular-nums">{{ row.date | date:'dd/MM/yy' }}</span> {{ row.description }}
                  @if (row.category) { <span class="text-xs text-gray-400 dark:text-gray-500">· {{ row.category }}</span> }
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

  /** Cells of the statement file, as read by `readStatementFile`. */
  readonly rows = input.required<string[][]>();
  /** Emits how many transactions were added. */
  readonly imported = output<number>();
  readonly closed = output<void>();

  protected readonly buttonClass = BUTTON;
  protected readonly selectClass = SELECT;
  protected readonly noColumn = NO_COLUMN;
  protected readonly previewRows = PREVIEW_ROWS;

  private readonly table = computed(() => {
    const rows = this.rows();
    const headerIndex = findHeaderRow(rows);
    return {
      header: rows[headerIndex] ?? [],
      data: rows.slice(headerIndex + 1),
      creditCard: looksLikeCreditCard(rows, headerIndex),
    };
  });
  protected readonly header = computed(() => this.table().header);

  protected readonly mapping = signal<ColumnMapping>({ date: 0, description: NO_COLUMN, amount: NO_COLUMN, debit: NO_COLUMN, credit: NO_COLUMN, category: NO_COLUMN, balance: NO_COLUMN });
  protected readonly hasCategoryColumn = computed(() => (this.mapping().category ?? NO_COLUMN) !== NO_COLUMN);
  protected readonly mode = signal<AmountMode>('signed');
  protected readonly positiveIsExpense = signal(false);
  protected readonly accountId = signal(this.accounts.defaultId());

  protected readonly expenseCategories = computed(() => this.tx.categories().filter(c => c.type === 'expense'));
  protected readonly incomeCategories = computed(() => this.tx.categories().filter(c => c.type === 'income'));
  // "Otros"-style catch-all categories are usually last.
  protected readonly expenseCategory = signal(this.expenseCategories().at(-1)?.id ?? '');
  protected readonly incomeCategory = signal(this.incomeCategories().at(-1)?.id ?? '');

  protected readonly statement = computed(() => {
    const mapping = this.mapping();
    const mode = this.mode();
    const effective = mode === 'split'
      ? { ...mapping, amount: NO_COLUMN, balance: NO_COLUMN }
      : { ...mapping, debit: NO_COLUMN, credit: NO_COLUMN, balance: mode === 'balance' ? mapping.balance : NO_COLUMN };
    return readStatement(this.table().data, effective, { positiveIsExpense: mode === 'signed' && this.positiveIsExpense() });
  });

  /** Movements before this day (YYYY-MM-DD) are left out; empty imports everything. */
  protected readonly fromDate = signal('');
  private readonly existing = computed(() => {
    const accountId = this.accountId();
    return this.tx.transactions().filter(t => t.accountId === accountId);
  });
  /** Latest movement already in the account, to help avoid importing overlapping periods twice. */
  protected readonly lastDate = computed(() => this.existing().reduce<string | null>((max, t) => (!max || t.date > max ? t.date : max), null));

  private readonly split = computed(() => {
    const from = this.fromDate();
    const rows = this.statement().rows;
    const inRange = from ? rows.filter(row => row.date >= from) : rows;
    const existing = this.existing();
    const fresh = inRange.filter(row => !existing.some(t => isSameMovement(t, row)));
    return { fresh, beforeFrom: rows.length - inRange.length, duplicates: inRange.length - fresh.length };
  });
  protected readonly newRows = computed(() => this.split().fresh);
  protected readonly duplicates = computed(() => this.split().duplicates);
  protected readonly beforeFrom = computed(() => this.split().beforeFrom);

  /** Other accounts in the same currency, which can receive or send a transfer. */
  protected readonly transferTargets = computed(() => {
    const own = this.accounts.getById(this.accountId());
    return this.accounts.accounts().filter(a => a.id !== own?.id && a.currency === own?.currency);
  });
  /** Account on the other side of card payments and of own transfers; empty keeps them as expenses and income. */
  protected readonly transferAccountIds = signal<Record<OwnTransferKind, string>>({ card: '', own: '' });
  /** For each kind found in the file: its rows, the chosen account and the transfers to create. */
  protected readonly transferGroups = computed(() => {
    if (this.transferTargets().length === 0) return [];
    const own = this.accountId();
    const existing = this.accounts.transfers();
    return TRANSFER_KINDS.map(kind => {
      const chosen = this.transferAccountIds()[kind.kind];
      const target = this.transferTargets().some(a => a.id === chosen) ? chosen : '';
      const rows = this.newRows().filter(row => ownTransferKind(row.description) === kind.kind);
      const transfers = !target ? [] : rows
        .map(row => ({
          fromAccountId: row.type === 'expense' ? own : target,
          toAccountId: row.type === 'expense' ? target : own,
          amount: row.amount,
          date: row.date,
          description: row.description,
        }))
        // Already recorded from the other account's statement.
        .filter(transfer => !existing.some(t => isSameTransfer(t, transfer)));
      return { ...kind, target, rows, transfers };
    }).filter(group => group.rows.length > 0);
  });

  /** Categories named in the file that don't exist yet for that type; importing creates them. */
  protected readonly missingCategories = computed(() => {
    const known = new Set(this.tx.categories().map(c => categoryKey(c.type, c.name)));
    const missing = new Map<string, Omit<Category, 'id' | 'color'>>();
    for (const row of this.newRows()) {
      if (!row.category) continue;
      const key = categoryKey(row.type, row.category);
      if (!known.has(key) && !missing.has(key)) missing.set(key, { name: row.category, type: row.type });
    }
    return [...missing.values()];
  });
  protected readonly missingCategoryNames = computed(() =>
    this.missingCategories().map(c => `${c.name} (${c.type === 'income' ? 'ingreso' : 'gasto'})`).join(', ')
  );

  constructor() {
    // Start from the columns we can recognize every time a new file arrives.
    effect(() => {
      const { header, data, creditCard } = this.table();
      const detected = detectColumns(header);
      const useSplit = detected.amount === NO_COLUMN && (detected.debit !== NO_COLUMN || detected.credit !== NO_COLUMN);
      const useBalance = !useSplit && detected.amount !== NO_COLUMN && detected.balance !== NO_COLUMN &&
        hasOnlyPositiveAmounts(data, detected.amount);
      const fallback = (index: number, other: number) => (index === NO_COLUMN ? other : index);
      this.mode.set(useSplit ? 'split' : useBalance ? 'balance' : 'signed');
      this.positiveIsExpense.set(creditCard);
      // Card payments usually go to the card account; moves between own accounts are less clear.
      this.transferAccountIds.set({ card: this.guessCardCounterpart(creditCard), own: '' });
      this.mapping.set({
        date: fallback(detected.date, 0),
        description: detected.description,
        amount: fallback(detected.amount, Math.min(1, header.length - 1)),
        debit: fallback(detected.debit, 0),
        credit: fallback(detected.credit, 0),
        category: detected.category,
        balance: fallback(detected.balance ?? NO_COLUMN, header.length - 1),
      });
    });
  }

  protected setColumn(field: keyof ColumnMapping, event: Event): void {
    const index = Number((event.target as HTMLSelectElement).value);
    this.mapping.update(mapping => ({ ...mapping, [field]: index }));
  }

  /** A card account for a checking account statement, and the reverse; none when it isn't clear. */
  private guessCardCounterpart(creditCard: boolean): string {
    const targets = this.transferTargets();
    const isCard = (name: string) => /tarjeta|credito|visa|mastercard/.test(normalize(name));
    const match = targets.find(a => (creditCard ? !isCard(a.name) : isCard(a.name)));
    return match?.id ?? (targets.length === 1 ? targets[0].id : '');
  }

  protected setTransferAccount(kind: OwnTransferKind, event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.transferAccountIds.update(ids => ({ ...ids, [kind]: id }));
  }

  protected dayAfter(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    return next.toISOString().slice(0, 10);
  }

  protected setMode(mode: AmountMode): void {
    this.mode.set(mode);
  }

  protected import(): void {
    for (const category of this.missingCategories()) {
      this.tx.addCategory({ ...category, color: unusedColor(this.tx.categories()) });
    }
    const ids = new Map(this.tx.categories().map(c => [categoryKey(c.type, c.name), c.id]));
    const asTransfers = new Set<OwnTransferKind>();
    for (const group of this.transferGroups()) {
      if (!group.target) continue;
      asTransfers.add(group.kind);
      for (const transfer of group.transfers) this.accounts.transfer(transfer);
    }
    const rows = this.newRows();
    for (const { category, ...row } of rows) {
      const kind = ownTransferKind(row.description);
      if (kind && asTransfers.has(kind)) continue;
      this.tx.add({
        ...row,
        categoryId: this.categoryFor(row.type, category, ids),
        accountId: this.accountId(),
      });
    }
    this.imported.emit(rows.length);
  }

  private categoryFor(type: CategoryType, name: StatementRow['category'], ids: Map<string, string>): string {
    const fallback = type === 'income' ? this.incomeCategory() : this.expenseCategory();
    return (name && ids.get(categoryKey(type, name))) || fallback;
  }
}
