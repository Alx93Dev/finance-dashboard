import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-summary-card',
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <p class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">{{ label() }}</p>
      <p
        class="text-3xl font-semibold tabular-nums"
        [class]="colorClass()"
      >
        {{ amount() | currency:'$':'symbol':'1.0-0' }}
      </p>
    </div>
  `,
})
export class SummaryCardComponent {
  readonly label      = input.required<string>();
  readonly amount     = input.required<number>();
  readonly colorClass = input<string>('text-gray-900');
}
