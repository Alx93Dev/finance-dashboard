import { TestBed } from '@angular/core/testing';
import { DataTransferPanelComponent } from './data-transfer-panel.component';
import { TransactionService } from '../../../core/services/transaction.service';
import { toBackup } from '../../../core/services/data-transfer';
import { Transaction } from '../../../core/models/transaction.model';

const STORED: Transaction[] = [
  { id: 'a', description: 'Arriendo', amount: 450000, categoryId: '7', date: '2025-01-01', type: 'expense' },
];

const BACKUP: Transaction[] = [
  { id: 'x', description: 'Sueldo', amount: 1000000, categoryId: '1', date: '2025-03-31', type: 'income'  },
  { id: 'y', description: 'Metro',  amount: 30000,   categoryId: '4', date: '2025-03-10', type: 'expense' },
];

function button(root: HTMLElement, label: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => b.textContent!.trim() === label)!;
}

describe('DataTransferPanelComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('transactions', JSON.stringify(STORED));
    localStorage.setItem('seeded_v3', 'true');
    await TestBed.configureTestingModule({ imports: [DataTransferPanelComponent] }).compileComponents();
  });

  it('should replace the transactions only after confirming the restore', async () => {
    const fixture = TestBed.createComponent(DataTransferPanelComponent);
    const tx = TestBed.inject(TransactionService);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.loadBackup(JSON.stringify(toBackup(BACKUP, 1)));
    await fixture.whenStable();
    expect(root.textContent).toContain('El respaldo tiene 2 transacciones y reemplazará las 1 actuales.');
    expect(tx.transactions()).toEqual(STORED);

    button(root, 'Reemplazar').click();
    await fixture.whenStable();
    expect(tx.transactions()).toEqual(BACKUP);
    expect(JSON.parse(localStorage.getItem('transactions')!)).toEqual(BACKUP);
    expect(tx.selectedMonth()).toBe('2025-03');
    expect(root.textContent).toContain('Se restauraron 2 transacciones.');
  });

  it('should keep the data when the restore is cancelled', async () => {
    const fixture = TestBed.createComponent(DataTransferPanelComponent);
    const tx = TestBed.inject(TransactionService);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.loadBackup(JSON.stringify(toBackup(BACKUP, 1)));
    await fixture.whenStable();
    button(root, 'Cancelar').click();
    await fixture.whenStable();

    expect(tx.transactions()).toEqual(STORED);
    expect(root.textContent).not.toContain('Reemplazar');
  });

  it('should show an error for a file that is not a backup', async () => {
    const fixture = TestBed.createComponent(DataTransferPanelComponent);
    await fixture.whenStable();

    fixture.componentInstance.loadBackup('{"hola": 1}');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('El archivo no es un respaldo de Finance Dashboard.');
  });
});
