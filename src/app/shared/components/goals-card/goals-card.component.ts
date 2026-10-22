import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { Goal } from '../../../core/models/goal.model';
import { GoalService, goalProgress } from '../../../core/services/goal.service';

const BUTTON = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
const PRIMARY = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
const INPUT = 'w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/** Which form is open: a new goal, editing one, or adding money to one. */
type Mode = { kind: 'new' } | { kind: 'edit'; id: string } | { kind: 'contribute'; id: string } | null;

@Component({
  selector: 'app-goals-card',
  imports: [CurrencyPipe, DatePipe, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
      <div class="flex items-center justify-between gap-4 mb-4">
        <h2 id="goals-heading" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Metas de ahorro</h2>
        @if (mode()?.kind !== 'new' && goals.goals().length > 0) {
          <button type="button" [class]="buttonClass" (click)="mode.set({ kind: 'new' })">Nueva meta</button>
        }
      </div>

      @if (mode()?.kind === 'new') {
        <ng-container *ngTemplateOutlet="goalForm; context: { $implicit: null }" />
      } @else if (goals.goals().length === 0) {
        <p class="text-sm text-gray-500 dark:text-gray-400">Ponle nombre y monto a lo que quieres juntar, y anota lo que vas ahorrando.</p>
        <button type="button" [class]="buttonClass + ' mt-3'" (click)="mode.set({ kind: 'new' })">Crear meta</button>
      }

      @if (goals.goals().length > 0) {
        <ul class="space-y-5" [class.mt-5]="mode()?.kind === 'new'" aria-labelledby="goals-heading">
          @for (goal of goals.goals(); track goal.id) {
            @let progress = progressOf(goal);
            <li>
              @if (isMode('edit', goal.id)) {
                <ng-container *ngTemplateOutlet="goalForm; context: { $implicit: goal }" />
              } @else {
                <div class="flex items-baseline justify-between gap-4 text-sm">
                  <span class="font-medium text-gray-900 dark:text-gray-100">{{ goal.name }}</span>
                  <span class="shrink-0 whitespace-nowrap tabular-nums text-gray-500 dark:text-gray-400">
                    {{ goal.saved | currency:'$':'symbol':'1.0-0' }} de {{ goal.target | currency:'$':'symbol':'1.0-0' }}
                  </span>
                </div>
                <div
                  class="mt-1.5 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
                  role="progressbar"
                  [attr.aria-label]="'Meta ' + goal.name"
                  aria-valuemin="0"
                  [attr.aria-valuemax]="goal.target"
                  [attr.aria-valuenow]="goal.saved"
                >
                  <div class="h-full rounded-full transition-all" [class]="progress.done ? 'bg-emerald-500' : 'bg-indigo-500'" [style.width.%]="progress.ratio * 100"></div>
                </div>
                <p class="mt-1 text-xs" [class]="progress.overdue ? 'text-red-600 dark:text-red-400' : progress.done ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'">
                  @if (progress.done) {
                    ¡Meta cumplida!
                  } @else if (progress.overdue) {
                    Venció el {{ goal.deadline | date:'d MMM y' }}; faltan {{ progress.remaining | currency:'$':'symbol':'1.0-0' }}
                  } @else if (progress.monthlyNeeded !== null) {
                    Ahorra {{ progress.monthlyNeeded | currency:'$':'symbol':'1.0-0' }} al mes para llegar al {{ goal.deadline | date:'d MMM y' }}
                  } @else {
                    Faltan {{ progress.remaining | currency:'$':'symbol':'1.0-0' }}
                  }
                </p>

                @if (isMode('contribute', goal.id)) {
                  <form (submit)="contribute($event, goal)" class="mt-3 flex flex-wrap items-center gap-2">
                    <label [for]="'contribution-' + goal.id" class="sr-only">Monto para {{ goal.name }}</label>
                    <input
                      [id]="'contribution-' + goal.id"
                      name="amount"
                      type="number"
                      min="1"
                      inputmode="numeric"
                      required
                      placeholder="Monto"
                      [class]="inputClass + ' max-w-40 text-right tabular-nums'"
                    />
                    <button type="submit" name="action" value="add" [class]="primaryClass">Abonar</button>
                    <button type="submit" name="action" value="withdraw" [class]="buttonClass" [disabled]="goal.saved === 0">Retirar</button>
                    <button type="button" [class]="buttonClass" (click)="mode.set(null)">Cancelar</button>
                  </form>
                } @else {
                  <div class="mt-2 flex gap-2">
                    @if (!progress.done) {
                      <button type="button" [class]="buttonClass" (click)="mode.set({ kind: 'contribute', id: goal.id })" [attr.aria-label]="'Abonar a ' + goal.name">Abonar</button>
                    }
                    <button type="button" [class]="buttonClass" (click)="mode.set({ kind: 'edit', id: goal.id })" [attr.aria-label]="'Editar ' + goal.name">Editar</button>
                  </div>
                }
              }
            </li>
          }
        </ul>
      }
    </div>

    <ng-template #goalForm let-goal>
      <form (submit)="save($event, goal)" class="space-y-3">
        <div>
          <label for="goal-name" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nombre</label>
          <input id="goal-name" name="name" required maxlength="60" placeholder="Ej: Viaje al sur" [value]="goal?.name ?? ''" [class]="inputClass" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="goal-target" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Monto objetivo</label>
            <input id="goal-target" name="target" type="number" min="1" inputmode="numeric" required [value]="goal?.target ?? ''" [class]="inputClass + ' tabular-nums'" />
          </div>
          <div>
            <label for="goal-deadline" class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha límite (opcional)</label>
            <input id="goal-deadline" name="deadline" type="date" [value]="goal?.deadline ?? ''" [class]="inputClass" />
          </div>
        </div>
        <div class="flex flex-wrap justify-between gap-2 pt-1">
          @if (goal) {
            <button type="button" (click)="remove(goal)" class="px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">Eliminar meta</button>
          } @else {
            <span></span>
          }
          <div class="flex gap-2">
            <button type="button" [class]="buttonClass" (click)="mode.set(null)">Cancelar</button>
            <button type="submit" [class]="primaryClass">Guardar</button>
          </div>
        </div>
      </form>
    </ng-template>
  `,
})
export class GoalsCardComponent {
  protected readonly goals = inject(GoalService);

  protected readonly buttonClass = BUTTON;
  protected readonly primaryClass = PRIMARY;
  protected readonly inputClass = INPUT;
  protected readonly mode = signal<Mode>(null);

  protected progressOf(goal: Goal) {
    return goalProgress(goal);
  }

  protected isMode(kind: 'edit' | 'contribute', id: string): boolean {
    const mode = this.mode();
    return mode?.kind === kind && mode.id === id;
  }

  protected save(event: Event, goal: Goal | null): void {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    const name = String(data.get('name') ?? '').trim();
    const target = Number(data.get('target'));
    if (!name || !(target > 0)) return;
    const changes = { name, target, deadline: String(data.get('deadline') ?? '') || null };
    if (goal) this.goals.update(goal.id, changes);
    else this.goals.add(changes);
    this.mode.set(null);
  }

  protected contribute(event: SubmitEvent, goal: Goal): void {
    event.preventDefault();
    const amount = Number(new FormData(event.target as HTMLFormElement).get('amount'));
    if (!(amount > 0)) return;
    const withdraw = (event.submitter as HTMLButtonElement | null)?.value === 'withdraw';
    this.goals.contribute(goal.id, withdraw ? -amount : amount);
    this.mode.set(null);
  }

  protected remove(goal: Goal): void {
    this.goals.remove(goal.id);
    this.mode.set(null);
  }
}
