import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MoneyPipe } from '../../pipes/money.pipe';
import { AccountService } from '../../../core/services/account.service';
import { RecurringService } from '../../../core/services/recurring.service';
import { TransactionService } from '../../../core/services/transaction.service';

@Component({
  selector: 'app-recurring-panel',
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (recurring.rules().length > 0) {
      <div class="mt-8 p-4 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900" role="region" aria-labelledby="recurring-title">
        <h2 id="recurring-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Recurrentes</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Se agregan solas cada mes. Las que ya se crearon no cambian si dejas de repetir.</p>
        <ul class="mt-3 divide-y divide-gray-100 dark:divide-gray-800" aria-labelledby="recurring-title">
          @for (rule of recurring.rules(); track rule.id) {
            <li class="flex items-center justify-between gap-4 py-2.5">
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ rule.description }}</p>
                <p class="text-xs text-gray-400 dark:text-gray-500">
                  {{ categoryName(rule.categoryId) }} · día {{ rule.dayOfMonth }} de cada mes
                </p>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <span
                  class="text-sm font-semibold tabular-nums"
                  [class]="rule.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'"
                >
                  {{ rule.type === 'income' ? '+' : '-' }}{{ rule.amount | money:(accounts.getById(rule.accountId)?.currency ?? 'CLP') }}
                </span>
                <button
                  type="button"
                  (click)="recurring.remove(rule.id)"
                  class="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  [attr.aria-label]="'Dejar de repetir ' + rule.description"
                >
                  Dejar de repetir
                </button>
              </div>
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class RecurringPanelComponent {
  protected readonly recurring = inject(RecurringService);
  private readonly tx = inject(TransactionService);
  protected readonly accounts = inject(AccountService);

  protected categoryName(categoryId: string): string {
    return this.tx.getCategoryById(categoryId)?.name ?? '—';
  }
}
