import { TestBed } from '@angular/core/testing';
import { GoalsCardComponent } from './goals-card.component';
import { GoalService } from '../../../core/services/goal.service';

function button(root: HTMLElement, label: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => b.textContent!.trim() === label)!;
}

function fill(root: HTMLElement, selector: string, value: string): void {
  root.querySelector<HTMLInputElement>(selector)!.value = value;
}

describe('GoalsCardComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [GoalsCardComponent] }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(GoalsCardComponent);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement, service: TestBed.inject(GoalService) };
  }

  it('should create a goal from the empty state', async () => {
    const { fixture, root, service } = await render();

    button(root, 'Crear meta').click();
    await fixture.whenStable();
    fill(root, '#goal-name', ' Viaje al sur ');
    fill(root, '#goal-target', '1000000');
    button(root, 'Guardar').click();
    await fixture.whenStable();

    expect(service.goals()).toEqual([expect.objectContaining({ name: 'Viaje al sur', target: 1000000, saved: 0, deadline: null })]);
    expect(root.textContent).toContain('Viaje al sur');
    expect(root.querySelector('#goal-name')).toBeNull();
  });

  it('should add and withdraw money', async () => {
    const { fixture, root, service } = await render();
    const { id } = service.add({ name: 'Viaje', target: 1000000, deadline: null });
    await fixture.whenStable();

    root.querySelector<HTMLButtonElement>('[aria-label="Abonar a Viaje"]')!.click();
    await fixture.whenStable();
    fill(root, `#contribution-${id}`, '300000');
    button(root, 'Abonar').click();
    await fixture.whenStable();
    expect(service.goals()[0].saved).toBe(300000);

    root.querySelector<HTMLButtonElement>('[aria-label="Abonar a Viaje"]')!.click();
    await fixture.whenStable();
    fill(root, `#contribution-${id}`, '50000');
    button(root, 'Retirar').click();
    await fixture.whenStable();
    expect(service.goals()[0].saved).toBe(250000);
  });

  it('should celebrate a reached goal and stop offering to add money', async () => {
    const { fixture, root, service } = await render();
    const { id } = service.add({ name: 'Viaje', target: 100000, deadline: null });
    service.contribute(id, 100000);
    await fixture.whenStable();

    expect(root.textContent).toContain('¡Meta cumplida!');
    expect(root.querySelector('[aria-label="Abonar a Viaje"]')).toBeNull();
  });

  it('should edit and delete a goal', async () => {
    const { fixture, root, service } = await render();
    service.add({ name: 'Viaje', target: 1000000, deadline: null });
    await fixture.whenStable();

    root.querySelector<HTMLButtonElement>('[aria-label="Editar Viaje"]')!.click();
    await fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('#goal-name')!.value).toBe('Viaje');
    fill(root, '#goal-deadline', '2099-12-31');
    button(root, 'Guardar').click();
    await fixture.whenStable();
    expect(service.goals()[0].deadline).toBe('2099-12-31');
    expect(root.textContent).toContain('al mes para llegar al');

    root.querySelector<HTMLButtonElement>('[aria-label="Editar Viaje"]')!.click();
    await fixture.whenStable();
    button(root, 'Eliminar meta').click();
    await fixture.whenStable();
    expect(service.goals()).toEqual([]);
    expect(root.textContent).toContain('Crear meta');
  });
});
