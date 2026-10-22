import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TransactionService } from '../../../core/services/transaction.service';
import { StorageService } from '../../../core/services/storage.service';
import { BudgetService } from '../../../core/services/budget.service';
import { GoalService } from '../../../core/services/goal.service';
import { AccountService } from '../../../core/services/account.service';
import { RecurringService } from '../../../core/services/recurring.service';
import { BackupData, parseBackup, toBackup, toCsv } from '../../../core/services/data-transfer';
import { StatementImportComponent } from '../statement-import/statement-import.component';

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

/** Bank exports are often Windows-1252 rather than UTF-8; accents would break otherwise. */
export function decodeText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

const BUTTON = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

@Component({
  selector: 'app-data-transfer-panel',
  imports: [StatementImportComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-8 p-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" role="region" aria-labelledby="data-transfer-title">
      <h2 id="data-transfer-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Tus datos</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Tus transacciones solo se guardan en este navegador. Descarga un respaldo para no perderlas,
        o importa la cartola de tu banco en CSV.
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
          <input type="file" accept=".csv,text/csv" class="sr-only" (change)="onStatementSelected($event)" />
        </label>
      </div>

      @if (statementText(); as text) {
        <app-statement-import [text]="text" (imported)="onStatementImported($event)" (closed)="statementText.set(null)" />
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
    </div>
  `,
})
export class DataTransferPanelComponent {
  protected readonly tx = inject(TransactionService);
  private readonly budgets = inject(BudgetService);
  private readonly recurring = inject(RecurringService);
  private readonly goals = inject(GoalService);
  private readonly accounts = inject(AccountService);
  private readonly storage = inject(StorageService);

  protected readonly buttonClass = BUTTON;
  protected readonly pendingImport = signal<BackupData | null>(null);
  protected readonly statementText = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly isError = signal(false);

  exportCsv(): void {
    download(`transacciones-${today()}.csv`, '﻿' + toCsv(this.tx.transactions(), this.tx.categories(), this.accounts.accounts()), 'text/csv;charset=utf-8');
  }

  exportBackup(): void {
    const backup = toBackup(
      {
        transactions: this.tx.transactions(),
        budgets: this.budgets.budgets(),
        categories: this.tx.categories(),
        recurring: this.recurring.rules(),
        goals: this.goals.goals(),
        accounts: this.accounts.accounts(),
        transfers: this.accounts.transfers(),
      },
      this.storage.schemaVersion(),
    );
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
    this.statementText.set(decodeText(await file.arrayBuffer()));
  }

  onStatementImported(count: number): void {
    this.statementText.set(null);
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
    if (backup.categories) this.tx.replaceCategories(backup.categories);
    if (backup.accounts) this.accounts.replaceAll(backup.accounts);
    if (backup.transfers) this.accounts.replaceTransfers(backup.transfers);
    this.tx.replaceAll(backup.transactions);
    if (backup.budgets) this.budgets.replaceAll(backup.budgets);
    if (backup.recurring) this.recurring.replaceAll(backup.recurring);
    if (backup.goals) this.goals.replaceAll(backup.goals);
    this.pendingImport.set(null);
    this.showMessage(`Se restauraron ${backup.transactions.length} transacciones.`, false);
  }

  private showMessage(text: string, isError: boolean): void {
    this.message.set(text);
    this.isError.set(isError);
  }
}
