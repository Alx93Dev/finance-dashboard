import { ApplicationConfig, LOCALE_ID, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { registerLocaleData } from '@angular/common';
import localeEsCL from '@angular/common/locales/es-CL';

import { routes } from './app.routes';
import { RecurringService } from './core/services/recurring.service';
import { AccountService } from './core/services/account.service';
import { ExchangeRateService } from './core/services/exchange-rate.service';
import { SyncService } from './core/sync/sync.service';

registerLocaleData(localeEsCL);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: LOCALE_ID, useValue: 'es-CL' },
    // Add the recurring transactions that came due while the app was closed.
    provideAppInitializer(() => { inject(RecurringService).generateDue(); }),
    // Get today's dollar and UF values in the background when an account needs them.
    provideAppInitializer(() => {
      if (inject(AccountService).hasForeignCurrency()) void inject(ExchangeRateService).refresh();
    }),
    // Restore the cloud sync session and bring the data up to date in the background.
    provideAppInitializer(() => { void inject(SyncService).start(); }),
    // Caches the app so it can be installed and opened offline.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ]
};
