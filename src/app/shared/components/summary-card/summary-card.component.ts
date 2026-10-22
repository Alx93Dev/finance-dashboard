import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-summary-card',
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
      <p class="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">{{ label() }}</p>
      <p
        class="text-3xl font-semibold tabular-nums"
        [class]="colorClass()"
      >
        {{ amount() | currency:'$':'symbol':'1.0-0' }}
      </p>
      @if (change() !== null) {
        <p class="mt-2 text-xs font-medium" [class]="changeClass()">
          <span aria-hidden="true">{{ change()! > 0 ? '▲' : change()! < 0 ? '▼' : '=' }}</span>
          {{ change()! > 0 ? '+' : '' }}{{ change() }}% vs mes anterior
        </p>
      }
    </div>
  `,
})
export class SummaryCardComponent {
  readonly label      = input.required<string>();
  readonly amount     = input.required<number>();
  readonly colorClass = input<string>('text-gray-900 dark:text-gray-100');
  /** Percentage change vs the previous month; null hides the line. */
  readonly change     = input<number | null>(null);
  /** Set to false when a rise is bad news (e.g. expenses). */
  readonly higherIsBetter = input(true);

  protected readonly changeClass = computed(() => {
    const change = this.change() ?? 0;
    if (change === 0) return 'text-gray-400 dark:text-gray-500';
    const good = change > 0 === this.higherIsBetter();
    return good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
  });
}
