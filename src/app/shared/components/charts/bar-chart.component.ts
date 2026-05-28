import { Component, OnInit, inject, ElementRef, viewChild } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { TransactionService } from '../../../core/services/transaction.service';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 class="text-sm font-medium text-gray-500 mb-4">Flujo mensual</h2>
      <div class="relative h-52">
        <canvas #chartCanvas></canvas>
      </div>
    </div>
  `,
})
export class BarChartComponent implements OnInit {
  private tx = inject(TransactionService);
  chartCanvas = viewChild.required<ElementRef>('chartCanvas');

  ngOnInit() {
    const months: Record<string, { income: number; expense: number }> = {};

    for (const t of this.tx.transactions()) {
      const month = t.date.slice(0, 7); // '2025-01'
      if (!months[month]) months[month] = { income: 0, expense: 0 };
      if (t.type === 'income') months[month].income += t.amount;
      else months[month].expense += t.amount;
    }

    const labels = Object.keys(months).sort();
    const income  = labels.map(m => months[m].income);
    const expense = labels.map(m => months[m].expense);

    new Chart(this.chartCanvas().nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Ingresos', data: income,  backgroundColor: '#10b981' },
          { label: 'Gastos',   data: expense, backgroundColor: '#ef4444' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 12 }, boxWidth: 12 } } },
        scales: { y: { ticks: { font: { size: 11 } } } },
      },
    });
  }
}