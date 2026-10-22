import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TransactionService } from '../../../core/services/transaction.service';

@Component({
  selector: 'app-sample-data-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tx.hasSampleData()) {
      <div
        class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-indigo-100 bg-indigo-50 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200"
        role="note"
      >
        <p>Estás viendo datos de ejemplo. Bórralos cuando quieras empezar con los tuyos.</p>
        <button
          type="button"
          (click)="tx.clearSampleData()"
          class="self-start sm:self-auto shrink-0 px-3 py-1.5 rounded-lg font-medium bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/60 dark:border-indigo-800 dark:text-indigo-100 dark:hover:bg-indigo-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Borrar datos de ejemplo
        </button>
      </div>
    }
  `,
})
export class SampleDataBannerComponent {
  protected readonly tx = inject(TransactionService);
}
