import { TestBed } from '@angular/core/testing';
import { CategoriesComponent } from './categories.component';
import { TransactionService } from '../../core/services/transaction.service';
import { BudgetService } from '../../core/services/budget.service';
import { Transaction } from '../../core/models/transaction.model';

const STORED: Transaction[] = [
  { id: 'a', description: 'Uber', amount: 18000, categoryId: '4', date: '2025-01-12', type: 'expense' },
];

function button(root: HTMLElement, label: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => (b.getAttribute('aria-label') ?? b.textContent!.trim()) === label)!;
}

function setValue(input: HTMLInputElement, value: string, event: 'change' | 'input' = 'change'): void {
  input.value = value;
  input.dispatchEvent(new Event(event));
}

describe('CategoriesComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('transactions', JSON.stringify(STORED));
    localStorage.setItem('seeded_v3', 'true');
    await TestBed.configureTestingModule({ imports: [CategoriesComponent] }).compileComponents();
  });

  it('should add a new expense category', async () => {
    const fixture = TestBed.createComponent(CategoriesComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const form = root.querySelector<HTMLFormElement>('section form')!;
    form.querySelector<HTMLInputElement>('input[name="name"]')!.value = 'Mascotas';
    form.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    const added = TestBed.inject(TransactionService).categories().find(c => c.name === 'Mascotas');
    expect(added?.type).toBe('expense');
    expect(root.querySelector<HTMLInputElement>('input[aria-label="Nombre de Mascotas"]')).not.toBeNull();
  });

  it('should reject a duplicate name and keep the old one', async () => {
    const fixture = TestBed.createComponent(CategoriesComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    setValue(root.querySelector<HTMLInputElement>('input[aria-label="Nombre de Transporte"]')!, 'salud');
    await fixture.whenStable();

    expect(root.textContent).toContain('Ya existe una categoría llamada «salud».');
    expect(TestBed.inject(TransactionService).getCategoryById('4')?.name).toBe('Transporte');
  });

  it('should move transactions and drop the budget when deleting a used category', async () => {
    TestBed.inject(BudgetService).setLimit('4', 50000);
    const fixture = TestBed.createComponent(CategoriesComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    button(root, 'Eliminar Transporte').click();
    await fixture.whenStable();
    expect(root.textContent).toContain('«Transporte» tiene 1 transacción. Muévelas a:');

    const select = root.querySelector<HTMLSelectElement>('#replacement-4')!;
    select.value = '8';
    select.dispatchEvent(new Event('change'));
    button(root, 'Mover y eliminar').click();
    await fixture.whenStable();

    const tx = TestBed.inject(TransactionService);
    expect(tx.getCategoryById('4')).toBeUndefined();
    expect(tx.transactions()[0].categoryId).toBe('8');
    expect(TestBed.inject(BudgetService).limitFor('4')).toBeNull();
  });

  it('should delete an unused category right away', async () => {
    const fixture = TestBed.createComponent(CategoriesComponent);
    await fixture.whenStable();

    button(fixture.nativeElement, 'Eliminar Salud').click();
    await fixture.whenStable();

    expect(TestBed.inject(TransactionService).getCategoryById('6')).toBeUndefined();
  });
});
