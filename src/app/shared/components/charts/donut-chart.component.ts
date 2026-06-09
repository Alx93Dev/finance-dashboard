import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { Chart } from 'chart.js/auto';
import { TransactionService } from '../../../core/services/transaction.service';

@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 class="text-sm font-medium text-gray-500 mb-4">Gastos por categoría</h2>
      <div class="relative h-52">
        <canvas #chartCanvas role="img" aria-label="Gráfico de gastos por categoría"></canvas>
      </div>
    </div>
  `,
})
export class DonutChartComponent {
  private readonly transactionService = inject(TransactionService);
  private readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private chart: Chart | null = null;

  constructor() {
    effect(() => {
      const expenses = this.transactionService.transactions().filter(t => t.type === 'expense');
      const categories = this.transactionService.categories();

      const amountByCategory: Record<string, number> = {};
      for (const t of expenses) {
        amountByCategory[t.categoryId] = (amountByCategory[t.categoryId] ?? 0) + t.amount;
      }

      const labels: string[] = [];
      const data: number[] = [];
      const colors: string[] = [];

      for (const [id, amount] of Object.entries(amountByCategory)) {
        const category = categories.find(c => c.id === id);
        if (category) {
          labels.push(category.name);
          data.push(amount);
          colors.push(category.color);
        }
      }

      if (this.chart) {
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.data.datasets[0].backgroundColor = colors;
        this.chart.update();
      } else {
        this.chart = new Chart(this.chartCanvas().nativeElement, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: { font: { size: 12 }, boxWidth: 12 },
              },
            },
          },
        });
      }
    });
  }
}
