import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TransactionService } from '../../core/services/transaction.service';
import { SummaryCardComponent } from '../../shared/components/summary-card/summary-card.component';

@Component({
  selector: 'app-dashboard',
  imports: [SummaryCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-5xl mx-auto px-4 py-8" id="main-content">
      <h1 class="text-2xl font-semibold text-gray-900 mb-6">Resumen</h1>

      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" class="sr-only">Resumen financiero</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <app-summary-card
            label="Ingresos"
            [amount]="transactionService.totalIncome()"
            colorClass="text-emerald-600"
          />
          <app-summary-card
            label="Gastos"
            [amount]="transactionService.totalExpenses()"
            colorClass="text-red-500"
          />
          <app-summary-card
            label="Balance"
            [amount]="transactionService.balance()"
            [colorClass]="transactionService.balance() >= 0 ? 'text-indigo-600' : 'text-red-600'"
          />
        </div>
      </section>
    </main>
  `,
})
export class DashboardComponent {
  protected readonly transactionService = inject(TransactionService);
}
