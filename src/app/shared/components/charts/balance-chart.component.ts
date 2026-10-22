import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { Chart } from 'chart.js/auto';
import { Transaction } from '../../../core/models/transaction.model';
import { TransactionService, shiftMonth } from '../../../core/services/transaction.service';
import { ThemeService } from '../../../core/services/theme.service';
import { chartThemeColors } from './chart-theme';
import { monthLabel } from './bar-chart.component';

export interface BalancePoint {
  month: string;
  balance: number;
}

/**
 * Accumulated balance at the end of each month, from the first month with
 * transactions to the last. Months without movements repeat the previous value.
 */
export function balanceTrend(transactions: Transaction[]): BalancePoint[] {
  if (transactions.length === 0) return [];

  const netByMonth = new Map<string, number>();
  for (const t of transactions) {
    const month = t.date.slice(0, 7);
    const signed = t.type === 'income' ? t.amount : -t.amount;
    netByMonth.set(month, (netByMonth.get(month) ?? 0) + signed);
  }

  const months = [...netByMonth.keys()].sort();
  const last = months[months.length - 1];
  const points: BalancePoint[] = [];
  let balance = 0;
  for (let month = months[0]; month <= last; month = shiftMonth(month, 1)) {
    balance += netByMonth.get(month) ?? 0;
    points.push({ month, balance });
  }
  return points;
}

const LINE_COLOR = '#6366f1';

const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

@Component({
  selector: 'app-balance-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
      <h2 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Evolución del balance</h2>
      <div class="relative h-52">
        <canvas #chartCanvas role="img" aria-label="Gráfico del balance acumulado mes a mes"></canvas>
      </div>
    </div>
  `,
})
export class BalanceChartComponent {
  private readonly transactionService = inject(TransactionService);
  private readonly themeService = inject(ThemeService);
  private readonly chartCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');
  private chart: Chart<'line'> | null = null;

  constructor() {
    effect(() => {
      const points = balanceTrend(this.transactionService.dashboardTransactions());
      const selected = this.transactionService.selectedMonth();
      const colors = chartThemeColors(this.themeService.theme());

      const labels = points.map(p => monthLabel(p.month));
      const data = points.map(p => p.balance);
      // Highlights the month picked on the dashboard.
      const radius = points.map(p => (p.month === selected ? 6 : 3));

      if (this.chart) {
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.data.datasets[0].pointRadius = radius;
        const { x, y } = this.chart.options.scales!;
        x!.ticks!.color = colors.text;
        x!.grid!.color = colors.grid;
        y!.ticks!.color = colors.text;
        y!.grid!.color = colors.grid;
        this.chart.update();
      } else {
        this.chart = new Chart(this.chartCanvas().nativeElement, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Balance acumulado',
              data,
              borderColor: LINE_COLOR,
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              pointBackgroundColor: LINE_COLOR,
              pointRadius: radius,
              fill: true,
              // Monotone keeps the curve from overshooting between months.
              cubicInterpolationMode: 'monotone',
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: item => currency.format(item.parsed.y ?? 0) } },
            },
            scales: {
              x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
              y: {
                ticks: { font: { size: 11 }, color: colors.text, callback: value => currency.format(Number(value)) },
                grid: { color: colors.grid },
              },
            },
          },
        });
      }
    });
  }
}
