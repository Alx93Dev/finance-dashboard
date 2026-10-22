import { TestBed } from '@angular/core/testing';
import { TransactionFormComponent } from './transaction-form.component';
import { Transaction } from '../../../core/models/transaction.model';
import { TransactionService } from '../../../core/services/transaction.service';
import { RecurringService } from '../../../core/services/recurring.service';

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

  it('should start a recurring rule when "Repetir cada mes" is checked', async () => {
    const fixture = TestBed.createComponent(TransactionFormComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const fill = (selector: string, value: string, event = 'input') => {
      const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
      el.value = value;
      el.dispatchEvent(new Event(event));
    };
    fill('#description', 'Netflix');
    fill('#amount', '9000');
    fill('#categoryId', '5', 'change');
    fill('#date', '2025-01-15');
    const repeat = root.querySelector<HTMLInputElement>('#repeat')!;
    repeat.checked = true;
    repeat.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

    expect(TestBed.inject(TransactionService).transactions().some(t => t.description === 'Netflix')).toBe(true);
    expect(TestBed.inject(RecurringService).rules()).toEqual([
      expect.objectContaining({ description: 'Netflix', amount: 9000, categoryId: '5', dayOfMonth: 15, lastMonth: '2025-01' }),
    ]);
  });

  it('should not offer to repeat when editing', async () => {
    const fixture = TestBed.createComponent(TransactionFormComponent);
    fixture.componentRef.setInput('editingTransaction', {
      id: 'a', description: 'Sueldo', amount: 1000, categoryId: '1', date: '2025-01-31', type: 'income',
    });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('#repeat')).toBeNull();
  });
});
