import { Injectable, signal } from '@angular/core';
import { MIGRATIONS, Migration } from './storage-migrations';

export const SCHEMA_VERSION_KEY = 'schema_version';

/** Keys holding the user's own data, which backups and cloud sync carry. */
export const DATA_KEYS = ['transactions', 'categories', 'budgets', 'recurring', 'goals', 'accounts', 'transfers'];

@Injectable({ providedIn: 'root' })
export class StorageService {
  /** Goes up each time any of the user's data (DATA_KEYS) is written. */
  readonly dataRevision = signal(0);

  constructor() {
    this.runMigrations(MIGRATIONS);
  }

  get<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
    if (DATA_KEYS.includes(key)) this.dataRevision.update(n => n + 1);
  }

  /** Version of the data currently in storage; 0 means it predates versioning. */
  schemaVersion(): number {
    const version = this.get<unknown>(SCHEMA_VERSION_KEY, 0);
    return typeof version === 'number' ? version : 0;
  }

  /**
   * Brings stored data up to the latest version, running each pending
   * migration once and in order. Data written by a newer app is left alone.
   */
  runMigrations(migrations: Migration[]): void {
    const latest = migrations.reduce((max, m) => Math.max(max, m.version), 0);
    const current = this.schemaVersion();
    if (current >= latest) return;

    const pending = migrations
      .filter(m => m.version > current)
      .sort((a, b) => a.version - b.version);
    for (const migration of pending) {
      migration.migrate(this);
      this.set(SCHEMA_VERSION_KEY, migration.version);
    }
  }
}
