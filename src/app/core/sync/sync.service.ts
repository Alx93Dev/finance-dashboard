import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { BackupService } from '../services/backup.service';
import { parseBackup } from '../services/data-transfer';
import { StorageService } from '../services/storage.service';
import { TransactionService } from '../services/transaction.service';
import { RemoteSnapshot, SYNC_BACKEND } from './sync-backend';

const META_KEY = 'sync_meta';
/** Waits this long after the last change before uploading, so a burst of edits is one write. */
export const PUSH_DELAY_MS = 2000;

interface SyncMeta {
  /** Timestamp of the cloud copy this device last read or wrote. */
  remoteUpdatedAt: string | null;
  /** Whether this device has changes the cloud doesn't have yet. */
  dirty: boolean;
}

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'conflict' | 'error';

function sameTime(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && Date.parse(a) === Date.parse(b);
}

/**
 * Keeps this device's data and the cloud copy in step. Local changes are
 * uploaded shortly after they happen; the cloud copy is read when the app
 * opens, regains focus or comes back online. When both changed, the user
 * picks which one to keep.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly backend = inject(SYNC_BACKEND);
  private readonly storage = inject(StorageService);
  private readonly backups = inject(BackupService);
  private readonly tx = inject(TransactionService);

  readonly enabled = this.backend !== null;
  readonly email = signal<string | null>(null);
  readonly status = signal<SyncStatus>(this.enabled ? 'signed-out' : 'off');
  readonly error = signal<string | null>(null);
  readonly lastSyncedAt = signal<Date | null>(null);
  readonly signedIn = computed(() => this.email() !== null);

  private meta: SyncMeta;
  /** The cloud copy waiting for the user to resolve a conflict. */
  private pendingRemote: RemoteSnapshot | null = null;
  /** Data revision written by applying the cloud copy, which isn't a local change. */
  private ignoredRevision = this.storage.dataRevision();
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // A device that never synced counts its data as unsynced only if the user entered some.
    this.meta = this.storage.get<SyncMeta>(META_KEY, {
      remoteUpdatedAt: null,
      dirty: this.tx.transactions().length > 0 && !this.tx.hasSampleData(),
    });
    if (!this.backend) return;

    effect(() => {
      const revision = this.storage.dataRevision();
      if (revision !== this.ignoredRevision) untracked(() => this.onLocalChange());
    });

    const onWake = () => void this.sync();
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
      clearTimeout(this.timer);
    });
  }

  /** Restores the session, if any, and syncs once. */
  async start(): Promise<void> {
    if (!this.backend) return;
    this.backend.onAuthChange(email => {
      const changed = email !== this.email();
      this.email.set(email);
      if (!email) this.status.set('signed-out');
      else if (changed) void this.sync();
    });
    try {
      this.email.set(await this.backend.currentEmail());
    } catch {
      this.email.set(null);
    }
    if (this.email()) await this.sync();
  }

  async sendSignInEmail(email: string): Promise<boolean> {
    return this.attempt(() => this.backend!.sendSignInEmail(email, window.location.origin));
  }

  async verifyCode(email: string, code: string): Promise<boolean> {
    const ok = await this.attempt(() => this.backend!.verifyCode(email, code));
    if (ok) {
      this.email.set(email);
      await this.sync();
    }
    return ok;
  }

  /** Signs out; this device keeps its data, and the next sign-in syncs it again. */
  async signOut(): Promise<void> {
    if (!(await this.attempt(() => this.backend!.signOut()))) return;
    this.email.set(null);
    this.status.set('signed-out');
    this.pendingRemote = null;
    this.saveMeta({ remoteUpdatedAt: null, dirty: true });
  }

  /** Brings both sides up to date; runs once at a time. */
  sync(): Promise<void> {
    if (!this.backend || !this.email() || this.status() === 'conflict') return Promise.resolve();
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  /** Resolves a conflict by replacing this device's data with the cloud copy. */
  async keepRemote(): Promise<void> {
    const remote = this.pendingRemote;
    if (!remote) return;
    this.pendingRemote = null;
    this.status.set('syncing');
    try {
      this.applyRemote(remote);
      this.markSynced();
    } catch (error) {
      this.fail(error);
    }
  }

  /** Resolves a conflict by replacing the cloud copy with this device's data. */
  async keepLocal(): Promise<void> {
    const remote = this.pendingRemote;
    if (!remote) return;
    this.pendingRemote = null;
    this.saveMeta({ remoteUpdatedAt: remote.updatedAt, dirty: true });
    this.status.set('syncing');
    await this.sync();
  }

  private onLocalChange(): void {
    if (!this.meta.dirty) this.saveMeta({ ...this.meta, dirty: true });
    this.schedulePush();
  }

  private schedulePush(): void {
    if (!this.email()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), PUSH_DELAY_MS);
  }

  private async run(): Promise<void> {
    const backend = this.backend!;
    this.status.set('syncing');
    this.error.set(null);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await backend.pull();
        const remoteChanged = remote !== null && !sameTime(remote.updatedAt, this.meta.remoteUpdatedAt);

        if (remoteChanged && this.meta.dirty) {
          this.pendingRemote = remote;
          this.status.set('conflict');
          return;
        }
        if (remoteChanged) {
          this.applyRemote(remote);
          this.markSynced();
          return;
        }
        if (!this.meta.dirty) {
          this.markSynced();
          return;
        }
        const revision = this.storage.dataRevision();
        const result = await backend.push(this.backups.snapshot(), remote?.updatedAt ?? null);
        // Another device wrote between our read and write: read again.
        if (result === 'conflict') continue;
        // Edits made while uploading still need to go up.
        const editedMeanwhile = this.storage.dataRevision() !== revision;
        this.saveMeta({ remoteUpdatedAt: result, dirty: editedMeanwhile });
        this.markSynced();
        if (editedMeanwhile) this.schedulePush();
        return;
      }
      throw new Error('Otro dispositivo está guardando cambios. Intenta de nuevo en un momento.');
    } catch (error) {
      this.fail(error);
    }
  }

  private applyRemote(remote: RemoteSnapshot): void {
    const backup = parseBackup(JSON.stringify(remote.data), this.storage.schemaVersion());
    this.backups.apply(backup);
    this.ignoredRevision = this.storage.dataRevision();
    this.saveMeta({ remoteUpdatedAt: remote.updatedAt, dirty: false });
  }

  private markSynced(): void {
    this.status.set('synced');
    this.lastSyncedAt.set(new Date());
  }

  private fail(error: unknown): void {
    this.status.set('error');
    this.error.set(error instanceof Error ? error.message : 'No se pudo sincronizar.');
  }

  /** Runs an auth call, reporting its error; true when it worked. */
  private async attempt(action: () => Promise<void>): Promise<boolean> {
    this.error.set(null);
    try {
      await action();
      return true;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Algo salió mal.');
      return false;
    }
  }

  private saveMeta(meta: SyncMeta): void {
    this.meta = meta;
    this.storage.set(META_KEY, meta);
  }
}
