import { TestBed } from '@angular/core/testing';
import { AccountsCardComponent } from './accounts-card.component';
import { AccountService } from '../../../core/services/account.service';
import { TransactionService } from '../../../core/services/transaction.service';

function button(root: HTMLElement, label: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => b.textContent!.trim() === label)!;
}

function inputs(root: HTMLElement, prefix: string): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>(`input[id^="${prefix}"]`));
}

describe('AccountsCardComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('transactions', JSON.stringify([
      { id: 'a', description: 'Sueldo', amount: 500000, categoryId: '1', date: '2025-01-31', type: 'income', accountId: 'main' },
    ]));
    localStorage.setItem('seeded_v3', 'true');
    await TestBed.configureTestingModule({ imports: [AccountsCardComponent] }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(AccountsCardComponent);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement, service: TestBed.inject(AccountService) };
  }

  it('should show the main account balance and suggest adding more', async () => {
    const { root } = await render();

    expect(root.textContent).toContain('Cuenta principal');
    expect(root.textContent).toMatch(/\$500[.,]000/);
    expect(root.textContent).toContain('Agrega más cuentas');
    expect(root.textContent).not.toContain('Total');
  });

  it('should add an account with an initial balance and show the total', async () => {
    const { fixture, root, service } = await render();

    button(root, 'Editar').click();
    await fixture.whenStable();
    button(root, 'Agregar cuenta').click();
    await fixture.whenStable();
    inputs(root, 'account-name-')[1].value = ' Efectivo ';
    inputs(root, 'account-balance-')[1].value = '30000';
    button(root, 'Guardar').click();
    await fixture.whenStable();

    expect(service.accounts().map(a => [a.name, a.initialBalance])).toEqual([['Cuenta principal', 0], ['Efectivo', 30000]]);
    expect(root.textContent).toContain('Total');
    expect(root.textContent).toMatch(/\$530[.,]000/);
  });

  it('should warn before moving a deleted account\'s transactions to the main one', async () => {
    const { fixture, root, service } = await render();
    const cash = service.add({ name: 'Efectivo', initialBalance: 0 });
    TestBed.inject(TransactionService).add({
      description: 'Almuerzo', amount: 8000, categoryId: '3', date: '2025-01-12', type: 'expense', accountId: cash.id,
    });
    await fixture.whenStable();

    button(root, 'Editar').click();
    await fixture.whenStable();
    expect(root.querySelector('[aria-label="Eliminar Cuenta principal"]')).toBeNull();
    root.querySelector<HTMLButtonElement>('[aria-label="Eliminar Efectivo"]')!.click();
    await fixture.whenStable();
    expect(root.textContent!.replace(/\s+/g, ' ')).toContain('el movimiento de Efectivo pasará a Cuenta principal');

    button(root, 'Guardar').click();
    await fixture.whenStable();
    expect(service.accounts().map(a => a.id)).toEqual(['main']);
    expect(TestBed.inject(TransactionService).transactions().every(t => t.accountId === 'main')).toBe(true);
  });

  it('should discard changes on cancel', async () => {
    const { fixture, root, service } = await render();

    button(root, 'Editar').click();
    await fixture.whenStable();
    inputs(root, 'account-name-')[0].value = 'Otro nombre';
    button(root, 'Cancelar').click();
    await fixture.whenStable();

    expect(service.accounts()[0].name).toBe('Cuenta principal');
  });
});
