import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavLink {
  path: string;
  label: string;
  ariaLabel: string;
}

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <nav
        class="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between"
        aria-label="Main navigation"
      >
        <a
          routerLink="/"
          class="text-lg font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 rounded"
          aria-label="Finance Dashboard home"
        >
          💰 Finance Dashboard
        </a>

        <ul class="flex gap-1" role="list">
          @for (link of navLinks; track link.path) {
            <li>
              <a
                [routerLink]="link.path"
                routerLinkActive="bg-indigo-50 text-indigo-700"
                [routerLinkActiveOptions]="{ exact: link.path === '/' }"
                class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                [attr.aria-label]="link.ariaLabel"
              >
                {{ link.label }}
              </a>
            </li>
          }
        </ul>
      </nav>
    </header>
  `,
})
export class NavComponent {
  protected readonly navLinks: NavLink[] = [
    { path: '/',             label: 'Dashboard',    ariaLabel: 'Go to Dashboard' },
    { path: '/transactions', label: 'Transacciones', ariaLabel: 'Go to Transactions' },
  ];
}
