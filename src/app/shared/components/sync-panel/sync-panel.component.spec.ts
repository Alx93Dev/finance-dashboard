import { TestBed } from '@angular/core/testing';
import { SYNC_BACKEND, SyncBackend } from '../../../core/sync/sync-backend';
import { SyncPanelComponent } from './sync-panel.component';

function backend(overrides: Partial<SyncBackend> = {}): SyncBackend {
  return {
    currentEmail: async () => null,
    onAuthChange: () => {},
    sendSignInEmail: vi.fn(async () => {}),
    verifyCode: vi.fn(async () => {}),
    signOut: async () => {},
    pull: async () => null,
    push: async () => '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function render(value: SyncBackend | null) {
  localStorage.clear();
  await TestBed.configureTestingModule({
    imports: [SyncPanelComponent],
    providers: [{ provide: SYNC_BACKEND, useValue: value }],
  }).compileComponents();
  const fixture = TestBed.createComponent(SyncPanelComponent);
  await fixture.whenStable();
  return fixture;
}

describe('SyncPanelComponent', () => {
  it('should render nothing when sync is not configured', async () => {
    const fixture = await render(null);
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('should send a sign-in email and then ask for the code', async () => {
    const fake = backend();
    const fixture = await render(fake);
    const element: HTMLElement = fixture.nativeElement;

    element.querySelector<HTMLInputElement>('#sync-email')!.value = 'ale@example.com';
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(fake.sendSignInEmail).toHaveBeenCalledWith('ale@example.com', window.location.origin);
    expect(element.textContent).toContain('Te enviamos un correo a ale@example.com');

    element.querySelector<HTMLInputElement>('#sync-code')!.value = '123456';
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(fake.verifyCode).toHaveBeenCalledWith('ale@example.com', '123456');
    expect(element.textContent).toContain('Conectado como ale@example.com');
  });

  it('should show sign-in errors', async () => {
    const fixture = await render(backend({ sendSignInEmail: async () => { throw new Error('Email rate limit exceeded'); } }));
    const element: HTMLElement = fixture.nativeElement;

    element.querySelector<HTMLInputElement>('#sync-email')!.value = 'ale@example.com';
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain('Email rate limit exceeded');
  });
});
