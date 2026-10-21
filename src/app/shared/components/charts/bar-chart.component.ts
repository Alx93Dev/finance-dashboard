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
import { ThemeService } from '../../../core/services/theme.service';
import { chartThemeColors } from './chart-theme';

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};

@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
      <h2 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Flujo mensual</h2>
      <div class="relative h-52">
        <canvas #chartCanvas role="img" aria-label="Gráfico de flujo mensual de ingresos y gastos"></canvas>
      </div>
    </div>
  `,
})
export class BarChartComponent {
  private readonly transactionService = inject(TransactionService);
  private readonly themeService = inject(ThemeService);
  private readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private chart: Chart | null = null;

  constructor() {
    effect(() => {
      const monthlyTotals: Record<string, { income: number; expense: number }> = {};

      for (const transaction of this.transactionService.transactions()) {
        const yearMonth = transaction.date.slice(0, 7);
        if (!monthlyTotals[yearMonth]) {
          monthlyTotals[yearMonth] = { income: 0, expense: 0 };
        }
        if (transaction.type === 'income') {
          monthlyTotals[yearMonth].income += transaction.amount;
        } else {
          monthlyTotals[yearMonth].expense += transaction.amount;
        }
      }

      const colors = chartThemeColors(this.themeService.theme());

      const sortedMonths = Object.keys(monthlyTotals).sort();
      const labels = sortedMonths.map(m => {
        const [, month] = m.split('-');
        return MONTH_LABELS[month] ?? m;
      });
      const incomeData  = sortedMonths.map(m => monthlyTotals[m].income);
      const expenseData = sortedMonths.map(m => monthlyTotals[m].expense);

      if (this.chart) {
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = incomeData;
        this.chart.data.datasets[1].data = expenseData;
        const { legend } = this.chart.options.plugins!;
        legend!.labels!.color = colors.text;
        const { x, y } = this.chart.options.scales!;
        x!.ticks!.color = colors.text;
        x!.grid!.color = colors.grid;
        y!.ticks!.color = colors.text;
        y!.grid!.color = colors.grid;
        this.chart.update();
      } else {
        this.chart = new Chart(this.chartCanvas().nativeElement, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Ingresos', data: incomeData,  backgroundColor: '#10b981' },
              { label: 'Gastos',   data: expenseData, backgroundColor: '#ef4444' },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
                labels: { font: { size: 12 }, boxWidth: 12, color: colors.text },
              },
            },
            scales: {
              x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
              y: { ticks: { font: { size: 11 }, color: colors.text }, grid: { color: colors.grid } },
            },
          },
        });
      }
    });
  }
}
