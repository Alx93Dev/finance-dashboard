import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideServiceWorker('ngsw-worker.js', { enabled: false })],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the skip link, nav and router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const skipLink = compiled.querySelector('a[href="#main-content"]');
    expect(skipLink?.textContent).toContain('Skip to main content');
    expect(compiled.querySelector('app-nav')).not.toBeNull();
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('should render nav links to the dashboard, transactions, categories and reports', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const nav = compiled.querySelector('nav[aria-label="Main navigation"]');
    expect(nav).not.toBeNull();
    const hrefs = Array.from(nav!.querySelectorAll('ul a')).map(a => a.getAttribute('href'));
    expect(hrefs).toEqual(['/', '/transactions', '/categories', '/reports']);
  });
});
