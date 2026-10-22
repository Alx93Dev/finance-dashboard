import { TestBed } from '@angular/core/testing';
import { BackupService } from '../services/backup.service';
import { TransactionService } from '../services/transaction.service';
import { RemoteSnapshot, SYNC_BACKEND, SyncBackend } from './sync-backend';
import { PUSH_DELAY_MS, SyncService } from './sync.service';
import { Transaction } from '../models/transaction.model';

const MINE: Transaction = { id: 'm', description: 'Café', amount: 3000, categoryId: '3', date: '2026-10-01', type: 'expense', accountId: 'main' };
const THEIRS: Transaction = { id: 't', description: 'Bencina', amount: 40000, categoryId: '4', date: '2026-10-02', type: 'expense', accountId: 'main' };

/** In-memory stand-in for Supabase. */
class FakeBackend implements SyncBackend {
  email: string | null = 'ale@example.com';
  remote: RemoteSnapshot | null = null;
  pushes = 0;
  private clock = 0;

  /** Simulates another device writing to the cloud. */
  writeFromElsewhere(data: unknown): void {
    this.remote = { data, updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, ++this.clock)).toISOString() };
  }

  async currentEmail() { return this.email; }
  onAuthChange() {}
  async sendSignInEmail() {}
  async verifyCode(email: string) { this.email = email; }
  async signOut() { this.email = null; }
  async pull() { return this.remote; }
  async push(data: unknown, expected: string | null) {
    const current = this.remote?.updatedAt ?? null;
    if (current !== expected) return 'conflict' as const;
    this.pushes++;
    this.writeFromElsewhere(data);
    return this.remote!.updatedAt;
  }
}

describe('SyncService', () => {
  let backend: FakeBackend;

  function setup(transactions: Transaction[] = [MINE]) {
    localStorage.clear();
    localStorage.setItem('seeded_v3', 'true');
    localStorage.setItem('transactions', JSON.stringify(transactions));
    backend = new FakeBackend();
    TestBed.configureTestingModule({ providers: [{ provide: SYNC_BACKEND, useValue: backend }] });
    return { sync: TestBed.inject(SyncService), tx: TestBed.inject(TransactionService), backups: TestBed.inject(BackupService) };
  }

  function remoteWith(transactions: Transaction[]) {
    return { ...TestBed.inject(BackupService).snapshot(), transactions };
  }

  afterEach(() => vi.useRealTimers());

  it('should upload local data when the cloud has none', async () => {
    const { sync } = setup();
    await sync.start();

    expect(sync.status()).toBe('synced');
    expect((backend.remote!.data as { transactions: Transaction[] }).transactions).toEqual([MINE]);
  });

  it('should download the cloud copy onto a device without its own data', async () => {
    const { sync, tx } = setup([]);
    backend.writeFromElsewhere(remoteWith([THEIRS]));

    await sync.start();

    expect(tx.transactions()).toEqual([THEIRS]);
    expect(backend.pushes).toBe(0);
  });

  it('should ask which copy to keep when both changed', async () => {
    const { sync, tx } = setup();
    backend.writeFromElsewhere(remoteWith([THEIRS]));

    await sync.start();
    expect(sync.status()).toBe('conflict');
    expect(tx.transactions()).toEqual([MINE]);

    await sync.keepRemote();
    expect(tx.transactions()).toEqual([THEIRS]);
    expect(sync.status()).toBe('synced');
  });

  it('should overwrite the cloud copy when keeping this device\'s data', async () => {
    const { sync } = setup();
    backend.writeFromElsewhere(remoteWith([THEIRS]));
    await sync.start();

    await sync.keepLocal();

    expect((backend.remote!.data as { transactions: Transaction[] }).transactions).toEqual([MINE]);
    expect(sync.status()).toBe('synced');
  });

  it('should upload local changes shortly after they happen', async () => {
    const { sync, tx } = setup();
    await sync.start();
    vi.useFakeTimers();

    tx.add({ ...THEIRS });
    TestBed.tick();
    expect(backend.pushes).toBe(1);
    await vi.advanceTimersByTimeAsync(PUSH_DELAY_MS);

    expect(backend.pushes).toBe(2);
    expect((backend.remote!.data as { transactions: Transaction[] }).transactions).toHaveLength(2);
  });

  it('should take changes from another device when this one has none', async () => {
    const { sync, tx } = setup();
    await sync.start();
    backend.writeFromElsewhere(remoteWith([MINE, THEIRS]));

    await sync.sync();
    TestBed.tick();

    expect(tx.transactions()).toEqual([MINE, THEIRS]);
    expect(sync.status()).toBe('synced');
    // Applying the cloud copy isn't a local change to upload back.
    await sync.sync();
    expect(backend.pushes).toBe(1);
  });

  it('should stay signed out and do nothing without a session', async () => {
    const { sync } = setup();
    backend.email = null;

    await sync.start();

    expect(sync.status()).toBe('signed-out');
    expect(backend.remote).toBeNull();
  });

  it('should report errors from the cloud', async () => {
    const { sync } = setup();
    backend.pull = () => Promise.reject(new Error('Sin conexión'));

    await sync.start();

    expect(sync.status()).toBe('error');
    expect(sync.error()).toBe('Sin conexión');
  });
});

describe('SyncService without a backend', () => {
  it('should be off', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: SYNC_BACKEND, useValue: null }] });
    const sync = TestBed.inject(SyncService);
    await sync.start();

    expect(sync.enabled).toBe(false);
    expect(sync.status()).toBe('off');
  });
});
