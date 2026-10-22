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

  it('should only offer transfers with several accounts', async () => {
    const { fixture, root, service } = await render();
    expect(button(root, 'Transferir')).toBeUndefined();

    service.add({ name: 'Efectivo', initialBalance: 0 });
    await fixture.whenStable();
    expect(button(root, 'Transferir')).toBeDefined();
  });

  it('should record a transfer and list it', async () => {
    const { fixture, root, service } = await render();
    service.add({ name: 'Efectivo', initialBalance: 0 });
    await fixture.whenStable();

    button(root, 'Transferir').click();
    await fixture.whenStable();
    expect(root.querySelector<HTMLSelectElement>('#transfer-to')!.selectedOptions[0].textContent!.trim()).toBe('Efectivo');
    root.querySelector<HTMLInputElement>('#transfer-amount')!.value = '60000';
    root.querySelector<HTMLInputElement>('#transfer-description')!.value = 'Cajero';
    root.querySelector<HTMLFormElement>('form[aria-label="Nueva transferencia"] button[type="submit"]')!.click();
    await fixture.whenStable();

    expect(service.transfers()).toEqual([expect.objectContaining({ fromAccountId: 'main', amount: 60000, description: 'Cajero' })]);
    expect(service.balances().map(b => b.balance)).toEqual([440000, 60000]);
    expect(root.textContent).toContain('Cuenta principal → Efectivo');

    root.querySelector<HTMLButtonElement>('[aria-label="Eliminar transferencia de Cuenta principal a Efectivo"]')!.click();
    await fixture.whenStable();
    expect(service.transfers()).toEqual([]);
    expect(root.textContent).not.toContain('Últimas transferencias');
  });

  it('should explain a transfer to the same account', async () => {
    const { fixture, root, service } = await render();
    service.add({ name: 'Efectivo', initialBalance: 0 });
    await fixture.whenStable();

    button(root, 'Transferir').click();
    await fixture.whenStable();
    root.querySelector<HTMLSelectElement>('#transfer-to')!.value = 'main';
    root.querySelector<HTMLInputElement>('#transfer-amount')!.value = '1000';
    root.querySelector<HTMLFormElement>('form[aria-label="Nueva transferencia"] button[type="submit"]')!.click();
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')!.textContent).toContain('Elige dos cuentas distintas.');
    expect(service.transfers()).toEqual([]);
  });
});
