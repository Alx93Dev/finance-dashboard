import { TestBed } from '@angular/core/testing';
import { StatementImportComponent } from './statement-import.component';
import { TransactionService } from '../../../core/services/transaction.service';
import { parseCsv } from '../../../core/services/statement-import';
import { AccountService } from '../../../core/services/account.service';
import { BillingCycle } from '../../../core/models/account.model';

const STATEMENT = [
  'Banco Ejemplo;Cuenta 123',
  'Fecha;Descripción;Cargos;Abonos;Saldo',
  '05/01/2025;Supermercado;12.990;;987.010',
  '06/01/2025;Transferencia recibida;;50.000;1.037.010',
  '07/01/2025;Uber;8.500;;1.028.510',
  'Saldo final;;;;1.028.510',
].join('\n');

describe('StatementImportComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('transactions', JSON.stringify([
      { id: 'u', description: 'UBER', amount: 8500, categoryId: '4', date: '2025-01-07', type: 'expense', accountId: 'main' },
    ]));
    localStorage.setItem('seeded_v3', 'true');
    await TestBed.configureTestingModule({ imports: [StatementImportComponent] }).compileComponents();
  });

  async function render(text = STATEMENT) {
    const fixture = TestBed.createComponent(StatementImportComponent);
    fixture.componentRef.setInput('rows', parseCsv(text));
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('should detect the columns and skip movements already recorded', async () => {
    const { root } = await render();

    expect(root.querySelector<HTMLSelectElement>('#statement-mode')!.value).toBe('split');
    const status = root.querySelector('[role="status"]')!.textContent!.replace(/\s+/g, ' ');
    expect(status).toContain('2 movimientos nuevos');
    expect(status).toContain('1 ya estaba registrado');
    expect(status).toContain('1 fila no se pudo leer');
    expect(root.textContent).toContain('Supermercado');
  });

  it('should import the new movements with the chosen categories', async () => {
    const { fixture, root } = await render();
    const imported: number[] = [];
    fixture.componentInstance.imported.subscribe(count => imported.push(count));

    const category = root.querySelector<HTMLSelectElement>('#statement-expense-category')!;
    category.value = '3';
    category.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    Array.from(root.querySelectorAll('button')).find(b => /^Importar \d+$/.test(b.textContent!.trim()))!.click();

    const tx = TestBed.inject(TransactionService).transactions();
    expect(imported).toEqual([2]);
    expect(tx).toHaveLength(3);
    expect(tx.find(t => t.description === 'Supermercado')).toMatchObject({ amount: 12990, type: 'expense', categoryId: '3', accountId: 'main', date: '2025-01-05' });
    expect(tx.find(t => t.description === 'Transferencia recibida')).toMatchObject({ amount: 50000, type: 'income', categoryId: '2' });
  });

  it('should let the user switch to a single signed amount column', async () => {
    const { fixture, root } = await render('Fecha,Detalle,Monto\n01/02/2025,Sueldo,"1.000.000"\n02/02/2025,Luz,-30.000\n');
    expect(root.querySelector<HTMLSelectElement>('#statement-mode')!.value).toBe('signed');
    expect(root.textContent).toContain('2 movimientos nuevos');

    const amount = root.querySelector<HTMLSelectElement>('#statement-amount')!;
    amount.value = '1';
    amount.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(root.textContent).toContain('0 movimientos nuevos');
  });

  it('should use the category column and create the categories that are missing', async () => {
    const { fixture, root } = await render([
      'Fecha;Descripción;Categoría;Cargo;Abono',
      '10/03/2025;Supermercado;alimentacion;20.000;',
      '11/03/2025;Pago Defontana;Sueldo;;900.000',
      '12/03/2025;Transfer a Juan;Transferencia;5.000;',
      '13/03/2025;Transfer de Juan;Transferencia;;5.000',
      '14/03/2025;Algo raro;;1.000;',
    ].join('\n'));
    expect(root.querySelector<HTMLSelectElement>('#statement-category')!.value).toBe('2');
    expect(root.textContent).toContain('Gastos sin categoría');
    expect(root.textContent).toContain('Se crearán estas categorías: Transferencia (gasto), Transferencia (ingreso).');

    Array.from(root.querySelectorAll('button')).find(b => /^Importar \d+$/.test(b.textContent!.trim()))!.click();
    await fixture.whenStable();

    const service = TestBed.inject(TransactionService);
    const categoryOf = (description: string) => {
      const t = service.transactions().find(t => t.description === description)!;
      return service.getCategoryById(t.categoryId)!;
    };
    expect(categoryOf('Supermercado')).toMatchObject({ id: '3', name: 'Alimentación' });
    expect(categoryOf('Pago Defontana')).toMatchObject({ id: '1' });
    expect(categoryOf('Transfer a Juan')).toMatchObject({ name: 'Transferencia', type: 'expense' });
    expect(categoryOf('Transfer de Juan')).toMatchObject({ name: 'Transferencia', type: 'income' });
    expect(categoryOf('Algo raro')).toMatchObject({ id: '8' });
    expect(service.categories().filter(c => c.name === 'Transferencia')).toHaveLength(2);
  });

  it('should flip the sign of credit card statements', async () => {
    const { root } = await render([
      'Detalle movimientos Tarjeta de Crédito',
      'Monto facturado;50000;;Fecha de inicio;21/8/2026',
      'Fecha;Código referencia;Descripción;Monto ($)',
      '17-09-2026;1;MONTO CANCELADO;-40000',
      '16-09-2026;2;LIBRERIA;12990',
    ].join('\n'));
    expect(root.querySelector<HTMLSelectElement>('#statement-mode')!.value).toBe('signed');
    expect(root.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    expect(root.textContent).toContain('2 movimientos nuevos');
    expect(root.textContent!.replace(/\s+/g, ' ')).toContain('LIBRERIA -$');
  });

  it('should use the balance column when the amount has no sign', async () => {
    const { root } = await render([
      'Fecha;Descripción;Monto $;Saldo Contable $',
      '20-10-2026;COMPRA CAFE;1390;8841',
      '19-10-2026;TRANSFER DE JUAN;40000;10231',
      '18-10-2026;PAGO TARJETA;10000;-29769',
    ].join('\n'));
    expect(root.querySelector<HTMLSelectElement>('#statement-mode')!.value).toBe('balance');
    expect(root.querySelector<HTMLSelectElement>('#statement-balance')!.value).toBe('3');
    const text = root.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('COMPRA CAFE -$');
    expect(text).toContain('TRANSFER DE JUAN +$');
  });

  it('should leave out movements before the chosen date', async () => {
    const { fixture, root } = await render();
    expect(root.textContent).toContain('Tu último movimiento en esta cuenta es del 07/01/25.');

    Array.from(root.querySelectorAll('button')).find(b => b.textContent!.includes('Importar solo lo posterior'))!.click();
    await fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('#statement-from')!.value).toBe('2025-01-08');
    const status = root.querySelector('[role="status"]')!.textContent!.replace(/\s+/g, ' ');
    expect(status).toContain('0 movimientos nuevos');
    expect(status).toContain('3 son anteriores a la fecha elegida');

    const from = root.querySelector<HTMLInputElement>('#statement-from')!;
    from.value = '2025-01-06';
    from.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(root.querySelector('[role="status"]')!.textContent!.replace(/\s+/g, ' ')).toContain('1 movimiento nuevo · 1 es anterior');
  });

  it('should record card payments as transfers to the card account, once', async () => {
    localStorage.setItem('accounts', JSON.stringify([
      { id: 'main', name: 'Cuenta corriente', initialBalance: 0, currency: 'CLP' },
      { id: 'card', name: 'Tarjeta de crédito', initialBalance: 0, currency: 'CLP' },
    ]));
    localStorage.setItem('transfers', JSON.stringify([
      { id: 't1', fromAccountId: 'main', toAccountId: 'card', amount: 20000, date: '2026-10-17', description: 'MONTO CANCELADO' },
    ]));
    const { fixture, root } = await render([
      'Fecha;Descripción;Cargo;Abono',
      '19/10/2026;PAGO TARJETA DE CREDITO MASTERCARD;10.000;',
      '18/10/2026;PAGO TARJETA DE CREDITO MASTERCARD;20.000;',
      '18/10/2026;MERPAGO*PEPO;3.150;',
      '18/10/2026;TRASPASO DE FONDOS ENTRE CUENTAS PROPIAS;1.000;',
    ].join('\n'));
    expect(root.querySelector<HTMLSelectElement>('#statement-transfer-own')!.value).toBe('');
    expect(root.querySelector<HTMLSelectElement>('#statement-transfer-card')!.value).toBe('card');
    expect(root.textContent).toContain('2 movimientos parecen pagos de tarjeta');
    expect(root.textContent).toContain('1 ya estaba registrado como transferencia');

    Array.from(root.querySelectorAll('button')).find(b => /^Importar \d+$/.test(b.textContent!.trim()))!.click();
    await fixture.whenStable();

    const transfers = TestBed.inject(AccountService).transfers();
    expect(transfers).toHaveLength(2);
    expect(transfers.find(t => t.id !== 't1')).toMatchObject({ fromAccountId: 'main', toAccountId: 'card', amount: 10000, date: '2026-10-19' });
    const tx = TestBed.inject(TransactionService).transactions();
    expect(tx.map(t => t.description)).toEqual(['UBER', 'MERPAGO*PEPO', 'TRASPASO DE FONDOS ENTRE CUENTAS PROPIAS']);
  });

  it('should reuse the category given before to the same merchant', async () => {
    localStorage.setItem('transactions', JSON.stringify([
      { id: 'r', description: 'Red Movilidad San 1234', amount: 1630, categoryId: '4', date: '2025-01-01', type: 'expense', accountId: 'main' },
    ]));
    const { fixture, root } = await render('Fecha;Descripción;Cargo;Abono\n05/01/2025;RED MOVILIDAD SAN 9999;1.630;\n06/01/2025;Kiosko;500;');
    expect(root.textContent).toContain('1 movimiento toma la categoría que usaste antes');
    expect(root.textContent).toContain('· Transporte');

    Array.from(root.querySelectorAll('button')).find(b => /^Importar \d+$/.test(b.textContent!.trim()))!.click();
    await fixture.whenStable();
    const tx = TestBed.inject(TransactionService).transactions();
    expect(tx.find(t => t.description === 'RED MOVILIDAD SAN 9999')!.categoryId).toBe('4');
    expect(tx.find(t => t.description === 'Kiosko')!.categoryId).toBe('8');
  });

  it('should warn about movements that look like one saved in another format', async () => {
    const { fixture, root } = await render('Fecha;Descripción;Cargo;Abono\n08/01/2025;Compra con Tarjeta de Débito en UBER;8.500;\n09/01/2025;Cine;5.000;');
    expect(root.textContent).toContain('1 movimiento podría estar repetido');
    expect(root.textContent).toContain('2 movimientos nuevos');

    const skip = root.querySelector<HTMLInputElement>('#statement-skip-similar')!;
    skip.checked = true;
    skip.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(root.textContent).toContain('1 movimiento nuevo');
  });

  describe('billing closing', () => {
    const CARD = 'Fecha;Descripción;Categoría;Cargo;Abono\n20/08/2026;MI PANERA;Alimentación;2790;\n17/09/2026;COBRO ADM MENSUAL;Gastos Banco;6962;\n05/09/2026;UNIMARC;Alimentación;8200;';

    function addCard(billing?: BillingCycle) {
      const service = TestBed.inject(AccountService);
      return service.add({ name: 'Tarjeta BCI', initialBalance: 0, currency: 'CLP', ...(billing ? { billing } : {}) });
    }

    async function pickAccount(fixture: { whenStable(): Promise<unknown> }, root: HTMLElement, id: string) {
      const select = root.querySelector<HTMLSelectElement>('#statement-account')!;
      select.value = id;
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    }

    const importButton = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('button')).find(b => /^Importar \d+$/.test(b.textContent!.trim()))!;

    it('should not offer it for an account that is not a card', async () => {
      addCard();
      const { root } = await render(CARD);
      expect(root.querySelector('#statement-closing')).toBeNull();
    });

    it('should save the statement\'s last day as the card\'s closing', async () => {
      const card = addCard();
      const { fixture, root } = await render(CARD);
      await pickAccount(fixture, root, card.id);

      expect(root.querySelector<HTMLInputElement>('#statement-closing')!.value).toBe('2026-09-17');
      importButton(root).click();
      await fixture.whenStable();

      expect(TestBed.inject(AccountService).getById(card.id)!.billing).toEqual({ closingDay: 17, closings: ['2026-09-17'] });
    });

    it('should save another date or none, as chosen', async () => {
      const card = addCard({ closingDay: 19 });
      const { fixture, root } = await render(CARD);
      await pickAccount(fixture, root, card.id);
      const closing = root.querySelector<HTMLInputElement>('#statement-closing')!;
      closing.value = '2026-09-18';
      closing.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      importButton(root).click();
      await fixture.whenStable();
      expect(TestBed.inject(AccountService).getById(card.id)!.billing).toEqual({ closingDay: 19, closings: ['2026-09-18'] });

      const other = addCard({ closingDay: 19 });
      const second = await render(CARD);
      await pickAccount(second.fixture, second.root, other.id);
      const save = second.root.querySelector<HTMLInputElement>('#statement-save-closing')!;
      save.checked = false;
      save.dispatchEvent(new Event('change'));
      await second.fixture.whenStable();
      importButton(second.root).click();
      expect(TestBed.inject(AccountService).getById(other.id)!.billing).toEqual({ closingDay: 19 });
    });
  });

  it('should explain an empty file', async () => {
    const { root } = await render('');
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('no tiene filas');
  });
});
