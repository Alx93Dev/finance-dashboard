import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReportsComponent } from './reports.component';

const STORED = [
  { id: 'a', description: 'Sueldo',   amount: 1000000, categoryId: '1', date: '2025-01-31', type: 'income',  accountId: 'main' },
  { id: 'b', description: 'Arriendo', amount: 400000,  categoryId: '7', date: '2025-01-01', type: 'expense', accountId: 'main' },
  { id: 'c', description: 'Regalo',   amount: 60000,   categoryId: '8', date: '2024-12-20', type: 'expense', accountId: 'main' },
];

describe('ReportsComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('seeded_v3', 'true');
    await TestBed.configureTestingModule({ imports: [ReportsComponent], providers: [provideRouter([])] }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(ReportsComponent);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  function button(root: HTMLElement, label: string): HTMLButtonElement {
    return root.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  }

  it('should invite to add transactions when there are none', async () => {
    const { root } = await render();
    expect(root.textContent).toContain('Aún no tienes transacciones');
  });

  it('should show the latest year and move between years with data', async () => {
    localStorage.setItem('transactions', JSON.stringify(STORED));
    const { fixture, root } = await render();

    expect(root.querySelector('[aria-live="polite"]')!.textContent!.trim()).toBe('2025');
    expect(root.textContent).toContain('60%');
    expect(root.textContent).toContain('Vivienda');
    expect(root.textContent).not.toContain('Regalo');
    expect(button(root, 'Año siguiente').disabled).toBe(true);

    button(root, 'Año anterior').click();
    await fixture.whenStable();
    expect(root.querySelector('[aria-live="polite"]')!.textContent!.trim()).toBe('2024');
    expect(root.textContent).toContain('Regalo');
    expect(button(root, 'Año anterior').disabled).toBe(true);
  });

  it('should compare the year with the one before', async () => {
    localStorage.setItem('transactions', JSON.stringify([
      ...STORED,
      { id: 'd', description: 'Sueldo', amount: 800000, categoryId: '1', date: '2024-12-31', type: 'income', accountId: 'main' },
    ]));
    const { fixture, root } = await render();

    // Income 1.000.000 vs 800.000, expenses 400.000 vs 60.000
    expect(root.textContent).toContain('▲ +25% vs 2024');
    expect(root.textContent).toContain('▲ +567% vs 2024');
    expect(root.textContent).toContain('sin gastos en 2024');

    button(root, 'Año anterior').click();
    await fixture.whenStable();
    expect(root.textContent).not.toContain('vs 2023');
  });

  it('should print the report in light mode and restore dark mode afterwards', async () => {
    localStorage.setItem('transactions', JSON.stringify(STORED));
    const { root } = await render();
    document.documentElement.classList.add('dark');
    let darkWhilePrinting: boolean | undefined;
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      darkWhilePrinting = document.documentElement.classList.contains('dark');
    });

    [...root.querySelectorAll('button')].find(b => b.textContent!.includes('Exportar PDF'))!.click();
    expect(print).toHaveBeenCalled();
    expect(darkWhilePrinting).toBe(false);

    window.dispatchEvent(new Event('afterprint'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    document.documentElement.classList.remove('dark');
    print.mockRestore();
  });
});
