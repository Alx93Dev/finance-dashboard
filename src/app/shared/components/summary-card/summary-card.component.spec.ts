import { TestBed } from '@angular/core/testing';
import { SummaryCardComponent } from './summary-card.component';

async function render(inputs: Record<string, unknown>) {
  await TestBed.configureTestingModule({ imports: [SummaryCardComponent] }).compileComponents();
  const fixture = TestBed.createComponent(SummaryCardComponent);
  fixture.componentRef.setInput('label', 'Gastos');
  fixture.componentRef.setInput('amount', 1000);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

function changeLine(root: HTMLElement): HTMLElement | null {
  return Array.from(root.querySelectorAll<HTMLElement>('p'))
    .find(p => p.textContent!.includes('vs mes anterior')) ?? null;
}

describe('SummaryCardComponent', () => {
  it('should hide the change line when there is nothing to compare', async () => {
    const root = await render({});
    expect(changeLine(root)).toBeNull();
  });

  it('should show a rise as good by default', async () => {
    const line = changeLine(await render({ change: 12 }))!;
    expect(line.textContent).toContain('+12% vs mes anterior');
    expect(line.className).toContain('text-emerald-600');
  });

  it('should show a rise as bad when higher is not better', async () => {
    const line = changeLine(await render({ change: 12, higherIsBetter: false }))!;
    expect(line.className).toContain('text-red-500');
  });

  it('should show a drop in expenses as good', async () => {
    const line = changeLine(await render({ change: -20, higherIsBetter: false }))!;
    expect(line.textContent).toContain('-20% vs mes anterior');
    expect(line.className).toContain('text-emerald-600');
  });
});
