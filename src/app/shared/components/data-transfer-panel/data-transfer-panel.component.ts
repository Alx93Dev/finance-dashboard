import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TransactionService } from '../../../core/services/transaction.service';
import { StorageService } from '../../../core/services/storage.service';
import { AccountService } from '../../../core/services/account.service';
import { BackupService } from '../../../core/services/backup.service';
import { BackupData, parseBackup, toCsv } from '../../../core/services/data-transfer';
import { StatementImportComponent } from '../statement-import/statement-import.component';
import { StatementFileError, readStatementFile } from '../../../core/services/statement-file';
import {
  CARD_PAYMENT_CATEGORY,
  REFUND_CATEGORY,
  isCardAccount,
  misreadCardCredits,
  normalize,
  planCardPaymentTransfers,
} from '../../../core/services/statement-import';
import { SyncPanelComponent } from '../sync-panel/sync-panel.component';
import { SyncService } from '../../../core/sync/sync.service';
import { unusedColor } from '../../../core/models/category.model';

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const BUTTON = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

@Component({
  selector: 'app-data-transfer-panel',
  imports: [StatementImportComponent, SyncPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-8 p-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" role="region" aria-labelledby="data-transfer-title">
      <h2 id="data-transfer-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Tus datos</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        @if (sync.signedIn()) {
          Tus datos se guardan en este navegador y en tu cuenta. También puedes descargar un respaldo
          o importar la cartola de tu banco en CSV, Excel o PDF.
        } @else {
          Tus transacciones solo se guardan en este navegador. Descarga un respaldo para no perderlas,
          o importa la cartola de tu banco en CSV, Excel o PDF.
        }
      </p>

      <div class="flex flex-wrap gap-2 mt-3">
        <button type="button" [class]="buttonClass" (click)="exportCsv()" [disabled]="tx.transactions().length === 0">Exportar CSV</button>
        <button type="button" [class]="buttonClass" (click)="exportBackup()">Descargar respaldo</button>
        <label [class]="buttonClass + ' cursor-pointer'">
          Restaurar respaldo
          <input type="file" accept=".json,application/json" class="sr-only" (change)="onFileSelected($event)" />
        </label>
        <label [class]="buttonClass + ' cursor-pointer'">
          Importar cartola
          <input type="file" accept=".csv,.xls,.xlsx,.pdf,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="sr-only" (change)="onStatementSelected($event)" />
        </label>
      </div>

      @if (statementRows(); as rows) {
        <app-statement-import [rows]="rows" (imported)="onStatementImported($event)" (closed)="statementRows.set(null)" />
      }

      @if (!statementRows() && cardCredits().length > 0) {
        <div class="mt-3 p-3 rounded-lg border border-gray-200 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
          <p>
            Tienes {{ cardCredits().length }} {{ cardCredits().length === 1 ? 'abono a la tarjeta guardado' : 'abonos a la tarjeta guardados' }}
            como gasto (pagos o devoluciones, como «Monto cancelado» o «Nota de crédito»). Son dinero que entra a la tarjeta:
            puedes corregirlos para que bajen lo que debes en vez de sumarse a tus gastos.
          </p>
          <button type="button" class="mt-2" [class]="buttonClass" (click)="fixCardCredits()">Corregir {{ cardCredits().length }}</button>
        </div>
      }

      @if (!statementRows() && cardPlan().remove.length > 0) {
        <div class="mt-3 p-3 rounded-lg border border-gray-200 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
          <p>
            Tienes {{ cardPlan().remove.length }} {{ cardPlan().remove.length === 1 ? 'pago de tarjeta guardado' : 'pagos de tarjeta guardados' }} como gasto o ingreso,
            lo que los cuenta dos veces. Puedes convertirlos en transferencias.
          </p>
          <div class="mt-2 flex flex-wrap items-end gap-2">
            <label class="text-xs text-gray-500 dark:text-gray-400">
              Cuenta de la tarjeta
              <select id="card-account" class="mt-1 block px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" (change)="cardAccountId.set($any($event.target).value)">
                @for (account of accounts.accounts(); track account.id) {
                  <option [value]="account.id" [selected]="account.id === cardAccount()">{{ account.name }}</option>
                }
              </select>
            </label>
            <button type="button" [class]="buttonClass" (click)="convertCardPayments()">Convertir {{ cardPlan().remove.length }}</button>
          </div>
        </div>
      }

      @if (pendingImport(); as pending) {
        <div class="mt-3 p-3 rounded-lg bg-amber-50 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="alert">
          <p>
            El respaldo tiene {{ pending.transactions.length }} transacciones y reemplazará las {{ tx.transactions().length }} actuales.
          </p>
          <div class="flex gap-2 mt-2">
            <button type="button" [class]="buttonClass" (click)="confirmImport()">Reemplazar</button>
            <button type="button" [class]="buttonClass" (click)="pendingImport.set(null)">Cancelar</button>
          </div>
        </div>
      }

      @if (message(); as text) {
        <p class="mt-3 text-sm" [class]="isError() ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'" role="status">
          {{ text }}
        </p>
      }

      <app-sync-panel />
    </div>
  `,
})
export class DataTransferPanelComponent {
  protected readonly tx = inject(TransactionService);
  protected readonly sync = inject(SyncService);
  protected readonly accounts = inject(AccountService);
  private readonly backups = inject(BackupService);
  private readonly storage = inject(StorageService);

  protected readonly buttonClass = BUTTON;
  protected readonly pendingImport = signal<BackupData | null>(null);
  protected readonly statementRows = signal<string[][] | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly isError = signal(false);

  /** Account of the credit card, for turning saved card payments into transfers. */
  protected readonly cardAccountId = signal('');
  protected readonly cardAccount = computed(() => {
    const accounts = this.accounts.accounts();
    const chosen = this.cardAccountId();
    if (accounts.some(a => a.id === chosen)) return chosen;
    return accounts.find(isCardAccount)?.id ?? '';
  });
  protected readonly cardPlan = computed(() => {
    const card = this.cardAccount();
    if (!card || !this.accounts.hasSeveral()) return { transfers: [], remove: [] };
    const other = this.accounts.defaultId() !== card
      ? this.accounts.defaultId()
      : this.accounts.accounts().find(a => a.id !== card)?.id ?? '';
    return planCardPaymentTransfers(
      this.tx.transactions(), this.accounts.transfers(), card, other, id => this.accounts.getById(id)?.currency
    );
  });

  /** Payments and refunds saved as expenses of a credit card account. */
  protected readonly cardCredits = computed(() => {
    const cards = new Set(this.accounts.accounts().filter(isCardAccount).map(a => a.id));
    return cards.size === 0 ? [] : misreadCardCredits(this.tx.transactions(), cards);
  });

  fixCardCredits(): void {
    const found = this.cardCredits();
    const categoryId = (name: string) => {
      const key = normalize(name);
      const existing = this.tx.categories().find(c => c.type === 'income' && normalize(c.name) === key);
      return (existing ?? this.tx.addCategory({ name, type: 'income', color: unusedColor(this.tx.categories()) })).id;
    };
    const ids = {
      refund: found.some(f => f.kind === 'refund') ? categoryId(REFUND_CATEGORY) : '',
      payment: found.some(f => f.kind === 'payment') ? categoryId(CARD_PAYMENT_CATEGORY) : '',
    };
    this.tx.updateMany(found.map(({ transaction, kind }) => ({ ...transaction, type: 'income', categoryId: ids[kind] })));
    this.showMessage(`Se corrigieron ${found.length} ${found.length === 1 ? 'abono' : 'abonos'} de tarjeta: ahora cuentan como dinero que entra a la tarjeta.`, false);
  }

  convertCardPayments(): void {
    const { transfers, remove } = this.cardPlan();
    for (const transfer of transfers) this.accounts.transfer(transfer);
    this.tx.removeMany(remove);
    this.showMessage(`Se convirtieron ${remove.length} ${remove.length === 1 ? 'pago de tarjeta' : 'pagos de tarjeta'} en ${transfers.length} ${transfers.length === 1 ? 'transferencia' : 'transferencias'}.`, false);
  }

  exportCsv(): void {
    download(`transacciones-${today()}.csv`, '﻿' + toCsv(this.tx.transactions(), this.tx.categories(), this.accounts.accounts()), 'text/csv;charset=utf-8');
  }

  exportBackup(): void {
    const backup = this.backups.snapshot();
    download(`respaldo-finanzas-${today()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.loadBackup(await file.text());
  }

  async onStatementSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.message.set(null);
    this.pendingImport.set(null);
    this.statementRows.set(null);
    try {
      this.statementRows.set(await readStatementFile(file));
    } catch (error) {
      this.showMessage(
        error instanceof StatementFileError ? error.message : 'No pudimos leer la cartola. Prueba con el archivo en CSV, Excel o PDF.',
        true
      );
    }
  }

  onStatementImported(count: number): void {
    this.statementRows.set(null);
    this.showMessage(`Se importaron ${count} ${count === 1 ? 'movimiento' : 'movimientos'} de la cartola.`, false);
  }

  loadBackup(text: string): void {
    this.message.set(null);
    try {
      this.pendingImport.set(parseBackup(text, this.storage.schemaVersion()));
    } catch (error) {
      this.pendingImport.set(null);
      this.showMessage((error as Error).message, true);
    }
  }

  confirmImport(): void {
    const backup = this.pendingImport();
    if (!backup) return;
    this.backups.apply(backup);
    this.pendingImport.set(null);
    this.showMessage(`Se restauraron ${backup.transactions.length} transacciones.`, false);
  }

  private showMessage(text: string, isError: boolean): void {
    this.message.set(text);
    this.isError.set(isError);
  }
}
