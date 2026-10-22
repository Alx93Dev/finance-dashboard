import { TestBed } from '@angular/core/testing';
import { BudgetsCardComponent } from './budgets-card.component';
import { BudgetService } from '../../../core/services/budget.service';
import { Transaction } from '../../../core/models/transaction.model';

const STORED: Transaction[] = [
  { id: 'a', description: 'Supermercado', amount: 85000, categoryId: '3', date: '2025-01-10', type: 'expense' },
];

function button(root: HTMLElement, label: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => b.textContent!.trim() === label)!;
}

describe('BudgetsCardComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('transactions', JSON.stringify(STORED));
    localStorage.setItem('seeded_v3', 'true');
    await TestBed.configureTestingModule({ imports: [BudgetsCardComponent] }).compileComponents();
  });

  it('should let the user define a budget and show its progress', async () => {
    const fixture = TestBed.createComponent(BudgetsCardComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    button(root, 'Definir presupuestos').click();
    await fixture.whenStable();
    root.querySelector<HTMLInputElement>('#budget-3')!.value = '100000';
    button(root, 'Guardar').click();
    await fixture.whenStable();

    expect(TestBed.inject(BudgetService).limitFor('3')).toBe(100000);
    const bar = root.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('85000');
    expect(bar.firstElementChild!.className).toContain('bg-amber-500');
    expect(root.textContent).toContain('Alimentación');
  });

  it('should say how much a category went over its budget', async () => {
    TestBed.inject(BudgetService).setLimit('3', 80000);
    const fixture = TestBed.createComponent(BudgetsCardComponent);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toMatch(/Te pasaste por \$5[.,]000/);
  });
});
