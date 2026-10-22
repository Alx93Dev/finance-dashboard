import { defineConfig, devices } from '@playwright/test';

const port = 4300;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    // The production build registers a service worker; keep it out of the
    // way so every test starts from a fresh page.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Tests run against the production build, so run `pnpm build` first.
  webServer: {
    command: `node scripts/serve-dist.mjs`,
    env: { PORT: String(port) },
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env['CI'],
  },
});
