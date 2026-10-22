import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SyncService } from '../../../core/sync/sync.service';

const BUTTON = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
const PRIMARY = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
const INPUT = 'px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/** Sign-in and status for cloud sync; renders nothing when sync isn't configured. */
@Component({
  selector: 'app-sync-panel',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sync.enabled) {
      <section class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800" aria-labelledby="sync-title">
        <h3 id="sync-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Sincronización</h3>

        @if (sync.signedIn()) {
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Conectado como <span class="font-medium text-gray-700 dark:text-gray-200">{{ sync.email() }}</span>.
          </p>
          <p class="mt-1 text-sm" role="status" [class]="sync.status() === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'">
            @switch (sync.status()) {
              @case ('syncing') { Sincronizando… }
              @case ('synced') { Al día{{ sync.lastSyncedAt() ? ' desde las ' + (sync.lastSyncedAt() | date:'HH:mm') : '' }}. }
              @case ('error') { {{ sync.error() }} }
            }
          </p>

          @if (sync.status() === 'conflict') {
            <div class="mt-2 p-3 rounded-lg bg-amber-50 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="alert">
              <p>Hay cambios en este equipo y también en la nube. ¿Cuáles quieres conservar? Los otros se reemplazan.</p>
              <div class="flex flex-wrap gap-2 mt-2">
                <button type="button" [class]="buttonClass" (click)="sync.keepLocal()">Los de este equipo</button>
                <button type="button" [class]="buttonClass" (click)="sync.keepRemote()">Los de la nube</button>
              </div>
            </div>
          }

          <div class="flex flex-wrap gap-2 mt-3">
            <button type="button" [class]="buttonClass" (click)="sync.sync()" [disabled]="sync.status() === 'syncing' || sync.status() === 'conflict'">Sincronizar ahora</button>
            <button type="button" [class]="buttonClass" (click)="sync.signOut()">Cerrar sesión</button>
          </div>
        } @else {
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Inicia sesión con tu correo para tener tus datos en todos tus dispositivos.
          </p>
          @if (sentTo(); as email) {
            <form class="mt-3 flex flex-wrap items-end gap-2" (submit)="verify($event, email)">
              <p class="w-full text-sm text-gray-600 dark:text-gray-300">
                Te enviamos un correo a {{ email }}. Abre el enlace en este dispositivo o escribe el código que trae.
              </p>
              <div>
                <label for="sync-code" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Código</label>
                <input id="sync-code" name="code" inputmode="numeric" autocomplete="one-time-code" required maxlength="10" [class]="inputClass + ' w-32 tracking-widest'" />
              </div>
              <button type="submit" [class]="primaryClass" [disabled]="busy()">Entrar</button>
              <button type="button" [class]="buttonClass" (click)="sentTo.set(null)">Usar otro correo</button>
            </form>
          } @else {
            <form class="mt-3 flex flex-wrap items-end gap-2" (submit)="send($event)">
              <div class="min-w-0 flex-1">
                <label for="sync-email" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Correo</label>
                <input id="sync-email" name="email" type="email" autocomplete="email" required [class]="inputClass + ' w-full'" />
              </div>
              <button type="submit" [class]="primaryClass" [disabled]="busy()">Enviar enlace</button>
            </form>
          }
          @if (sync.error(); as error) {
            <p class="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">{{ error }}</p>
          }
        }
      </section>
    }
  `,
})
export class SyncPanelComponent {
  protected readonly sync = inject(SyncService);
  protected readonly buttonClass = BUTTON;
  protected readonly primaryClass = PRIMARY;
  protected readonly inputClass = INPUT;
  /** Email the sign-in message went to, while waiting for the user to use it. */
  protected readonly sentTo = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    const email = String(new FormData(event.target as HTMLFormElement).get('email') ?? '').trim();
    if (!email) return;
    this.busy.set(true);
    if (await this.sync.sendSignInEmail(email)) this.sentTo.set(email);
    this.busy.set(false);
  }

  protected async verify(event: Event, email: string): Promise<void> {
    event.preventDefault();
    const code = String(new FormData(event.target as HTMLFormElement).get('code') ?? '').trim();
    if (!code) return;
    this.busy.set(true);
    if (await this.sync.verifyCode(email, code)) this.sentTo.set(null);
    this.busy.set(false);
  }
}
