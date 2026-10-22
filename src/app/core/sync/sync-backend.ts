import { InjectionToken } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './sync.config';

/** The copy of the user's data kept in the cloud. */
export interface RemoteSnapshot {
  data: unknown;
  /** When it was last written; also used to detect writes from other devices. */
  updatedAt: string;
}

/** What the sync service needs from the cloud; a fake stands in for it in tests. */
export interface SyncBackend {
  /** Email of the signed-in user, or null. */
  currentEmail(): Promise<string | null>;
  /** Calls `listener` with the email whenever the user signs in or out. */
  onAuthChange(listener: (email: string | null) => void): void;
  /** Emails a sign-in link, plus a code if the email template includes it. */
  sendSignInEmail(email: string, redirectTo: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  pull(): Promise<RemoteSnapshot | null>;
  /**
   * Writes `data` if the cloud copy is still the one from `expectedUpdatedAt`
   * (null when there should be none yet). Returns the new timestamp, or
   * 'conflict' when another device wrote in between.
   */
  push(data: unknown, expectedUpdatedAt: string | null): Promise<string | 'conflict'>;
}

export const SYNC_BACKEND = new InjectionToken<SyncBackend | null>('SYNC_BACKEND', {
  providedIn: 'root',
  factory: () => (SUPABASE_URL && SUPABASE_ANON_KEY ? new SupabaseBackend(SUPABASE_URL, SUPABASE_ANON_KEY) : null),
});

const TABLE = 'snapshots';

/** Supabase's messages for the errors a user is likely to hit, in Spanish. */
const MESSAGES: [RegExp, string][] = [
  [/rate limit/i, 'Enviaste varios correos seguidos. Espera unos minutos y vuelve a intentarlo.'],
  [/expired|invalid/i, 'El código no es válido o ya venció. Pide un correo nuevo.'],
  [/fetch|network/i, 'No hay conexión con el servidor. Se intentará de nuevo al volver a abrir la app.'],
];

/** Turns a Supabase error into an exception for the sync service to report. */
function fail(error: { message: string } | null): void {
  if (!error) return;
  throw new Error(MESSAGES.find(([pattern]) => pattern.test(error.message))?.[1] ?? error.message);
}

/** Stores one row per user in the `snapshots` table; see supabase/schema.sql. */
export class SupabaseBackend implements SyncBackend {
  private client: Promise<SupabaseClient> | null = null;

  constructor(private readonly url: string, private readonly key: string) {}

  /** Loads the Supabase library only when sync is used, keeping it out of the main bundle. */
  private supabase(): Promise<SupabaseClient> {
    this.client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(this.url, this.key));
    return this.client;
  }

  async currentEmail(): Promise<string | null> {
    const { data } = await (await this.supabase()).auth.getSession();
    return data.session?.user.email ?? null;
  }

  onAuthChange(listener: (email: string | null) => void): void {
    void this.supabase().then(client =>
      client.auth.onAuthStateChange((_event, session) => listener(session?.user.email ?? null)));
  }

  async sendSignInEmail(email: string, redirectTo: string): Promise<void> {
    const { error } = await (await this.supabase()).auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    fail(error);
  }

  async verifyCode(email: string, code: string): Promise<void> {
    const { error } = await (await this.supabase()).auth.verifyOtp({ email, token: code, type: 'email' });
    fail(error);
  }

  async signOut(): Promise<void> {
    const { error } = await (await this.supabase()).auth.signOut();
    fail(error);
  }

  async pull(): Promise<RemoteSnapshot | null> {
    const { data, error } = await (await this.supabase()).from(TABLE).select('data, updated_at').maybeSingle();
    fail(error);
    return data ? { data: data.data, updatedAt: data.updated_at } : null;
  }

  async push(data: unknown, expectedUpdatedAt: string | null): Promise<string | 'conflict'> {
    const client = await this.supabase();
    const updatedAt = new Date().toISOString();
    if (expectedUpdatedAt === null) {
      const { error } = await client.from(TABLE).insert({ data, updated_at: updatedAt });
      // A row already exists: another device synced first.
      if (error?.code === '23505') return 'conflict';
      fail(error);
      return updatedAt;
    }
    const { data: rows, error } = await client
      .from(TABLE)
      .update({ data, updated_at: updatedAt })
      .eq('updated_at', expectedUpdatedAt)
      .select('updated_at');
    fail(error);
    return rows && rows.length > 0 ? updatedAt : 'conflict';
  }
}
