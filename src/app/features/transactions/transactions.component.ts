import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-5xl mx-auto px-4 py-8" id="main-content">
      <h1 class="text-2xl font-semibold text-gray-900">Transacciones</h1>
      <p class="mt-2 text-gray-500">Próximamente — Sesión 4.</p>
    </main>
  `,
})
export class TransactionsComponent {}
