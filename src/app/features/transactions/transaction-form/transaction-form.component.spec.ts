import { TestBed } from '@angular/core/testing';
import { TransactionFormComponent } from './transaction-form.component';
import { Transaction } from '../../../core/models/transaction.model';

function categoryOptions(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLOptionElement>('#categoryId option'))
    .filter(option => !option.disabled)
    .map(option => option.textContent!.trim());
}

function typeButton(root: HTMLElement, label: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('fieldset button'))
    .find(button => button.textContent!.trim() === label)!;
}

describe('TransactionFormComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [TransactionFormComponent] }).compileComponents();
  });

  it('should list expense categories by default', async () => {
    const fixture = TestBed.createComponent(TransactionFormComponent);
    await fixture.whenStable();

    expect(categoryOptions(fixture.nativeElement)).toEqual([
      'Alimentación', 'Transporte', 'Entretenimiento', 'Salud', 'Vivienda', 'Otros',
    ]);
  });

  it('should switch the category list when the type changes', async () => {
    const fixture = TestBed.createComponent(TransactionFormComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    typeButton(root, 'Ingreso').click();
    await fixture.whenStable();
    expect(categoryOptions(root)).toEqual(['Sueldo', 'Freelance']);

    typeButton(root, 'Gasto').click();
    await fixture.whenStable();
    expect(categoryOptions(root)).toContain('Alimentación');
    expect(categoryOptions(root)).not.toContain('Sueldo');
  });

  it('should list income categories when editing an income', async () => {
    const income: Transaction = {
      id: 'a', description: 'Sueldo', amount: 1000, categoryId: '1', date: '2025-01-31', type: 'income',
    };
    const fixture = TestBed.createComponent(TransactionFormComponent);
    fixture.componentRef.setInput('editingTransaction', income);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(categoryOptions(root)).toEqual(['Sueldo', 'Freelance']);
    expect(root.querySelector<HTMLSelectElement>('#categoryId')!.value).toBe('1');
  });
});
