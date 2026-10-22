import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Tells the user when the installed app has downloaded a newer version. */
@Component({
  selector: 'app-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (updateReady()) {
      <div
        class="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 z-30 flex items-center justify-between gap-4 px-4 py-3 rounded-xl shadow-lg bg-indigo-600 text-white text-sm"
        role="status"
      >
        <span>Hay una versión nueva de la app.</span>
        <button
          type="button"
          (click)="reload()"
          class="shrink-0 px-3 py-1.5 rounded-lg font-medium bg-white/15 hover:bg-white/25 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Actualizar
        </button>
      </div>
    }
  `,
})
export class UpdateBannerComponent {
  private readonly swUpdate = inject(SwUpdate);
  protected readonly updateReady = signal(false);

  constructor() {
    if (!this.swUpdate.isEnabled) return;
    this.swUpdate.versionUpdates
      .pipe(filter(event => event.type === 'VERSION_READY'), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.updateReady.set(true));
  }

  protected reload(): void {
    document.location.reload();
  }
}
