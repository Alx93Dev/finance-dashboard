import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TransactionService } from '../../../core/services/transaction.service';
import { StorageService } from '../../../core/services/storage.service';
import { BudgetService } from '../../../core/services/budget.service';
import { RecurringService } from '../../../core/services/recurring.service';
import { BackupData, parseBackup, toBackup, toCsv } from '../../../core/services/data-transfer';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-8 p-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" role="region" aria-labelledby="data-transfer-title">
      <h2 id="data-transfer-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Tus datos</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Tus transacciones solo se guardan en este navegador. Descarga un respaldo para no perderlas.
      </p>

      <div class="flex flex-wrap gap-2 mt-3">
        <button type="button" [class]="buttonClass" (click)="exportCsv()" [disabled]="tx.transactions().length === 0">Exportar CSV</button>
        <button type="button" [class]="buttonClass" (click)="exportBackup()">Descargar respaldo</button>
        <label [class]="buttonClass + ' cursor-pointer'">
          Restaurar respaldo
          <input type="file" accept=".json,application/json" class="sr-only" (change)="onFileSelected($event)" />
        </label>
      </div>

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
  private readonly storage = inject(StorageService);

  protected readonly buttonClass = BUTTON;
  protected readonly pendingImport = signal<BackupData | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly isError = signal(false);

  exportCsv(): void {
    download(`transacciones-${today()}.csv`, '﻿' + toCsv(this.tx.transactions(), this.tx.categories()), 'text/csv;charset=utf-8');
  }

  exportBackup(): void {
    const backup = toBackup(
      {
        transactions: this.tx.transactions(),
        budgets: this.budgets.budgets(),
        categories: this.tx.categories(),
        recurring: this.recurring.rules(),
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
    this.tx.replaceAll(backup.transactions);
    if (backup.budgets) this.budgets.replaceAll(backup.budgets);
    if (backup.recurring) this.recurring.replaceAll(backup.recurring);
    this.pendingImport.set(null);
    this.showMessage(`Se restauraron ${backup.transactions.length} transacciones.`, false);
  }

  private showMessage(text: string, isError: boolean): void {
    this.message.set(text);
    this.isError.set(isError);
  }
}
