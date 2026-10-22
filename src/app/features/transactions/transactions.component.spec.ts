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

  describe('search and category filter', () => {
    async function render() {
      const fixture = TestBed.createComponent(TransactionsComponent);
      await fixture.whenStable();
      return { fixture, root: fixture.nativeElement as HTMLElement };
    }

    async function search(fixture: { whenStable(): Promise<unknown> }, root: HTMLElement, term: string) {
      const input = root.querySelector<HTMLInputElement>('#search')!;
      input.value = term;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    }

    async function pickCategory(fixture: { whenStable(): Promise<unknown> }, root: HTMLElement, id: string) {
      const select = root.querySelector<HTMLSelectElement>('#category-filter')!;
      select.value = id;
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    }

    it('should filter by description ignoring case and accents', async () => {
      const { fixture, root } = await render();

      await search(fixture, root, 'ARRIÉNDO');
      expect(descriptions(root)).toEqual(['Arriendo']);

      await search(fixture, root, 'el');
      expect(descriptions(root)).toEqual(['Sueldo', 'Freelance']);
    });

    it('should filter by category', async () => {
      const { fixture, root } = await render();

      await pickCategory(fixture, root, '4');
      expect(descriptions(root)).toEqual(['Uber']);

      await pickCategory(fixture, root, '');
      expect(descriptions(root).length).toBe(4);
    });

    it('should only offer categories of the selected type and drop a mismatched one', async () => {
      const { fixture, root } = await render();
      await pickCategory(fixture, root, '4');

      filterButton(root, 'Ingresos').click();
      await fixture.whenStable();

      const options = Array.from(root.querySelectorAll<HTMLOptionElement>('#category-filter option'))
        .map(o => o.textContent!.trim());
      expect(options).toEqual(['Todas las categorías', 'Sueldo', 'Freelance']);
      expect(descriptions(root)).toEqual(['Sueldo', 'Freelance']);
    });

    it('should combine search, type and category filters', async () => {
      const { fixture, root } = await render();

      filterButton(root, 'Gastos').click();
      await fixture.whenStable();
      await search(fixture, root, 'r');
      expect(descriptions(root)).toEqual(['Uber', 'Arriendo']);

      await pickCategory(fixture, root, '7');
      expect(descriptions(root)).toEqual(['Arriendo']);
    });

    it('should explain when nothing matches', async () => {
      const { fixture, root } = await render();

      await search(fixture, root, 'zzz');
      expect(descriptions(root)).toEqual([]);
      expect(root.textContent).toContain('Ninguna transacción coincide con la búsqueda');
    });
  });

  describe('undo delete', () => {
    function deleteButton(root: HTMLElement, description: string): HTMLButtonElement {
      return root.querySelector<HTMLButtonElement>(`button[aria-label="Eliminar ${description}"]`)!;
    }

    function undoButton(root: HTMLElement): HTMLButtonElement | undefined {
      return Array.from(root.querySelectorAll<HTMLButtonElement>('[role="status"] button'))
        .find(button => button.textContent!.trim() === 'Deshacer');
    }

    afterEach(() => vi.useRealTimers());

    it('should show an undo toast after deleting and restore the transaction', async () => {
      const fixture = TestBed.createComponent(TransactionsComponent);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;

      deleteButton(root, 'Uber').click();
      await fixture.whenStable();
      expect(descriptions(root)).toEqual(['Sueldo', 'Arriendo', 'Freelance']);
      expect(root.querySelector('[role="status"]')?.textContent).toContain('Se eliminó «Uber»');

      undoButton(root)!.click();
      await fixture.whenStable();
      expect(descriptions(root)).toEqual(['Sueldo', 'Uber', 'Arriendo', 'Freelance']);
      expect(root.querySelector('[role="status"]')).toBeNull();
      expect(JSON.parse(localStorage.getItem('transactions')!).map((t: Transaction) => t.id)).toContain('c');
    });

    it('should hide the toast after a few seconds', async () => {
      vi.useFakeTimers();
      const fixture = TestBed.createComponent(TransactionsComponent);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;

      deleteButton(root, 'Uber').click();
      fixture.detectChanges();
      expect(undoButton(root)).toBeDefined();

      vi.advanceTimersByTime(5000);
      fixture.detectChanges();
      expect(root.querySelector('[role="status"]')).toBeNull();
      expect(descriptions(root)).not.toContain('Uber');
    });

    it('should only offer to undo the most recent delete', async () => {
      const fixture = TestBed.createComponent(TransactionsComponent);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;

      deleteButton(root, 'Uber').click();
      await fixture.whenStable();
      deleteButton(root, 'Arriendo').click();
      await fixture.whenStable();
      expect(root.querySelector('[role="status"]')?.textContent).toContain('Se eliminó «Arriendo»');

      undoButton(root)!.click();
      await fixture.whenStable();
      expect(descriptions(root)).toEqual(['Sueldo', 'Arriendo', 'Freelance']);
    });
  });

  describe('empty state and sample data', () => {
    it('should offer to add the first transaction when there are none', async () => {
      localStorage.setItem('transactions', '[]');
      const fixture = TestBed.createComponent(TransactionsComponent);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;

      const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
        .find(b => b.textContent!.trim() === 'Agregar primera transacción');
      expect(button).toBeDefined();

      button!.click();
      await fixture.whenStable();
      expect(root.querySelector('app-transaction-form')).not.toBeNull();
    });

    it('should not show the sample data banner for the user\'s own data', async () => {
      localStorage.setItem('transactions', JSON.stringify([
        { id: 'x', description: 'Café', amount: 3000, categoryId: '3', date: '2025-02-01', type: 'expense' },
      ]));
      const fixture = TestBed.createComponent(TransactionsComponent);
      await fixture.whenStable();

      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('datos de ejemplo');
    });

    it('should clear the sample data from the banner', async () => {
      localStorage.clear();
      const fixture = TestBed.createComponent(TransactionsComponent);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      expect(descriptions(root).length).toBe(8);

      const clear = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
        .find(b => b.textContent!.trim() === 'Borrar datos de ejemplo')!;
      clear.click();
      await fixture.whenStable();

      expect(descriptions(root)).toEqual([]);
      expect(root.textContent).not.toContain('Estás viendo datos de ejemplo');
      expect(root.textContent).toContain('Agregar primera transacción');
    });
  });
});
