import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { UpdateBannerComponent } from './update-banner.component';

function setup(isEnabled: boolean) {
  const versionUpdates = new Subject<VersionEvent>();
  TestBed.configureTestingModule({
    imports: [UpdateBannerComponent],
    providers: [{ provide: SwUpdate, useValue: { isEnabled, versionUpdates } }],
  });
  const fixture = TestBed.createComponent(UpdateBannerComponent);
  return { fixture, versionUpdates };
}

const READY = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'a' },
  latestVersion: { hash: 'b' },
} as VersionEvent;

describe('UpdateBannerComponent', () => {
  it('should stay hidden until a new version is ready', async () => {
    const { fixture, versionUpdates } = setup(true);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).not.toContain('versión nueva');

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } } as VersionEvent);
    await fixture.whenStable();
    expect(root.textContent).not.toContain('versión nueva');

    versionUpdates.next(READY);
    await fixture.whenStable();
    expect(root.textContent).toContain('Hay una versión nueva de la app.');
  });

  it('should do nothing when the service worker is disabled', async () => {
    const { fixture, versionUpdates } = setup(false);
    versionUpdates.next(READY);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('versión nueva');
  });
});
