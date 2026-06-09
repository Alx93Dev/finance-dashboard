import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TransactionService } from '../../core/services/transaction.service';
import { SummaryCardComponent } from '../../shared/components/summary-card/summary-card.component';
import { DonutChartComponent } from '../../shared/components/charts/donut-chart.component';
import { BarChartComponent } from '../../shared/components/charts/bar-chart.component';

@Component({
  selector: 'app-dashboard',
  imports: [SummaryCardComponent, DonutChartComponent, BarChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-5xl mx-auto px-4 py-8" id="main-content">
      <h1 class="text-2xl font-semibold text-gray-900 mb-6">Resumen</h1>

      <section aria-labelledby="summary-heading" class="mb-6">
        <h2 id="summary-heading" class="sr-only">Resumen financiero</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <app-summary-card
            label="Ingresos"
            [amount]="tx.totalIncome()"
            colorClass="text-emerald-600"
          />
          <app-summary-card
            label="Gastos"
            [amount]="tx.totalExpenses()"
            colorClass="text-red-500"
          />
          <app-summary-card
            label="Balance"
            [amount]="tx.balance()"
            [colorClass]="tx.balance() >= 0 ? 'text-indigo-600' : 'text-red-600'"
          />
        </div>
      </section>

      <section aria-label="Gráficos" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <app-donut-chart />
        <app-bar-chart />
      </section>
    </main>
  `,
})
export class DashboardComponent {
  protected readonly tx = inject(TransactionService);
}

