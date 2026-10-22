import { TestBed } from '@angular/core/testing';
import { StatementImportComponent } from './statement-import.component';
import { TransactionService } from '../../../core/services/transaction.service';

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
    fixture.componentRef.setInput('text', text);
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
    Array.from(root.querySelectorAll('button')).find(b => b.textContent!.includes('Importar'))!.click();

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

  it('should explain an empty file', async () => {
    const { root } = await render('');
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('no tiene filas');
  });
});
