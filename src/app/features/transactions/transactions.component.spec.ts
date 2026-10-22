import { TestBed } from '@angular/core/testing';
import { TransactionsComponent } from './transactions.component';
import { Transaction } from '../../core/models/transaction.model';

const STORED: Transaction[] = [
  { id: 'a', description: 'Arriendo',   amount: 450000,  categoryId: '7', date: '2025-01-01', type: 'expense' },
  { id: 'b', description: 'Sueldo',     amount: 1200000, categoryId: '1', date: '2025-01-31', type: 'income'  },
  { id: 'c', description: 'Uber',       amount: 18000,   categoryId: '4', date: '2025-01-12', type: 'expense' },
  { id: 'd', description: 'Freelance',  amount: 350000,  categoryId: '2', date: '2024-12-15', type: 'income'  },
];

function descriptions(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('section ul li p:first-child'))
    .map(p => p.textContent!.trim());
}

function filterButton(root: HTMLElement, label: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('[aria-label="Filtrar transacciones"] button'))
    .find(button => button.textContent!.trim() === label)!;
}

describe('TransactionsComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('transactions', JSON.stringify(STORED));
    localStorage.setItem('seeded_v3', 'true');
    await TestBed.configureTestingModule({ imports: [TransactionsComponent] }).compileComponents();
  });

  it('should list transactions from most recent to oldest', async () => {
    const fixture = TestBed.createComponent(TransactionsComponent);
    await fixture.whenStable();

    expect(descriptions(fixture.nativeElement)).toEqual(['Sueldo', 'Uber', 'Arriendo', 'Freelance']);
  });

  it('should keep the date order when filtering', async () => {
    const fixture = TestBed.createComponent(TransactionsComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    filterButton(root, 'Ingresos').click();
    await fixture.whenStable();
    expect(descriptions(root)).toEqual(['Sueldo', 'Freelance']);

    filterButton(root, 'Gastos').click();
    await fixture.whenStable();
    expect(descriptions(root)).toEqual(['Uber', 'Arriendo']);
  });
});
