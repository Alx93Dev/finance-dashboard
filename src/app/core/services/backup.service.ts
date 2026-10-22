import { Injectable, inject } from '@angular/core';
import { AccountService } from './account.service';
import { BudgetService } from './budget.service';
import { Backup, BackupData, toBackup } from './data-transfer';
import { GoalService } from './goal.service';
import { RecurringService } from './recurring.service';
import { StorageService } from './storage.service';
import { TransactionService } from './transaction.service';

/** Reads and replaces all of the user's data at once, for backups and cloud sync. */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly tx = inject(TransactionService);
  private readonly budgets = inject(BudgetService);
  private readonly recurring = inject(RecurringService);
  private readonly goals = inject(GoalService);
  private readonly accounts = inject(AccountService);
  private readonly storage = inject(StorageService);

  snapshot(): Backup {
    return toBackup(
      {
        transactions: this.tx.transactions(),
        budgets: this.budgets.budgets(),
        categories: this.tx.categories(),
        recurring: this.recurring.rules(),
        goals: this.goals.goals(),
        accounts: this.accounts.accounts(),
        transfers: this.accounts.transfers(),
      },
      this.storage.schemaVersion(),
    );
  }

  /** Replaces the current data; lists the backup doesn't have are kept as they are. */
  apply(backup: BackupData): void {
    if (backup.categories) this.tx.replaceCategories(backup.categories);
    if (backup.accounts) this.accounts.replaceAll(backup.accounts);
    if (backup.transfers) this.accounts.replaceTransfers(backup.transfers);
    this.tx.replaceAll(backup.transactions);
    if (backup.budgets) this.budgets.replaceAll(backup.budgets);
    if (backup.recurring) this.recurring.replaceAll(backup.recurring);
    if (backup.goals) this.goals.replaceAll(backup.goals);
  }
}
