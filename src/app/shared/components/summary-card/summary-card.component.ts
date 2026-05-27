import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-summary-card',
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <p class="text-sm text-gray-500 mb-1">{{ label() }}</p>
      <p class="text-2xl font-semibold" [class]="colorClass()">
        {{ amount() | currency:'CLP':'$':'1.0-0' }}
      </p>
    </div>
  `,
})
export class SummaryCardComponent {
  label = input.required<string>();
  amount = input.required<number>();
  colorClass = input<string>('text-gray-900');
}
