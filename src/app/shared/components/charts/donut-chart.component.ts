import { Component, OnInit, inject, ElementRef, viewChild } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { TransactionService } from '../../../core/services/transaction.service';

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  template: `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 class="text-sm font-medium text-gray-500 mb-4">Gastos por categoría</h2>
      <div class="relative h-52">
        <canvas #chartCanvas></canvas>
      </div>
    </div>
  `,
})
export class DonutChartComponent implements OnInit {
  private tx = inject(TransactionService);
  chartCanvas = viewChild.required<ElementRef>('chartCanvas');

  ngOnInit() {
    const expenses = this.tx.transactions().filter(t => t.type === 'expense');

    const byCategory: Record<string, number> = {};
    for (const t of expenses) {
      byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + t.amount;
    }

    const categories = this.tx.categories();
    const labels: string[] = [];
    const data: number[] = [];
    const colors: string[] = [];

    for (const [id, amount] of Object.entries(byCategory)) {
      const cat = categories.find(c => c.id === id);
      if (cat) {
        labels.push(cat.name);
        data.push(amount);
        colors.push(cat.color);
      }
    }

    new Chart(this.chartCanvas().nativeElement, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 12 }, boxWidth: 12 } },
        },
      },
    });
  }
}