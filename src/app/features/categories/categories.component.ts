import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TransactionService } from '../../core/services/transaction.service';
import { BudgetService } from '../../core/services/budget.service';
import { RecurringService } from '../../core/services/recurring.service';
import { Category, CategoryType, unusedColor } from '../../core/models/category.model';

/** Colors offered to new categories, in order, skipping ones already in use. */

interface Group {
  type: CategoryType;
  title: string;
  categories: Category[];
}

interface PendingDelete {
  category: Category;
  /** What uses the category, e.g. "2 transacciones y 1 recurrente". */
  usage: string;
  replacementId: string;
}

const BUTTON = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
const INPUT = 'px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

@Component({
  selector: 'app-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-3xl mx-auto px-4 py-8" id="main-content">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Categorías</h1>
      <p class="text-gray-500 dark:text-gray-400 text-sm mt-1 mb-6">Renombra, cambia el color o agrega tus propias categorías.</p>

      @if (error(); as text) {
        <p class="mb-4 px-4 py-3 rounded-xl bg-red-50 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">{{ text }}</p>
      }

      @for (group of groups(); track group.type) {
        <section class="mb-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm" [attr.aria-labelledby]="'group-' + group.type">
          <h2 [id]="'group-' + group.type" class="px-5 pt-5 pb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{{ group.title }}</h2>
          <ul class="divide-y divide-gray-100 dark:divide-gray-800">
            @for (category of group.categories; track category.id) {
              <li class="px-5 py-3">
                <div class="flex items-center gap-3">
                  <input
                    type="color"
                    [value]="category.color"
                    (change)="recolor(category, $any($event.target).value)"
                    class="w-8 h-8 shrink-0 rounded cursor-pointer border-0 bg-transparent p-0"
                    [attr.aria-label]="'Color de ' + category.name"
                  />
                  <input
                    type="text"
                    [value]="category.name"
                    (change)="rename(category, $any($event.target))"
                    maxlength="40"
                    [class]="inputClass + ' flex-1 min-w-0'"
                    [attr.aria-label]="'Nombre de ' + category.name"
                  />
                  <span class="hidden sm:inline w-28 text-right text-xs text-gray-400 dark:text-gray-500 tabular-nums">{{ usageLabel(category) }}</span>
                  <button
                    type="button"
                    [class]="buttonClass"
                    (click)="askDelete(category)"
                    [disabled]="group.categories.length <= 1"
                    [attr.title]="group.categories.length <= 1 ? 'Debe quedar al menos una categoría' : null"
                    [attr.aria-label]="'Eliminar ' + category.name"
                  >
                    Eliminar
                  </button>
                </div>

                @if (pendingDelete()?.category?.id === category.id) {
                  <div class="mt-3 p-3 rounded-lg bg-amber-50 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="group" aria-label="Confirmar eliminación">
                    <label [for]="'replacement-' + category.id">
                      «{{ category.name }}» tiene {{ pendingDelete()!.usage }}. Muévelas a:
                    </label>
                    <div class="flex flex-wrap gap-2 mt-2">
                      <select
                        [id]="'replacement-' + category.id"
                        [class]="inputClass"
                        (change)="setReplacement($any($event.target).value)"
                      >
                        @for (other of group.categories; track other.id) {
                          @if (other.id !== category.id) {
                            <option [value]="other.id" [selected]="other.id === pendingDelete()!.replacementId">{{ other.name }}</option>
                          }
                        }
                      </select>
                      <button type="button" [class]="buttonClass" (click)="confirmDelete()">Mover y eliminar</button>
                      <button type="button" [class]="buttonClass" (click)="pendingDelete.set(null)">Cancelar</button>
                    </div>
                  </div>
                }
              </li>
            }
          </ul>

          <form class="flex items-center gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800" (submit)="add($event, group.type)">
            <input
              type="color"
              name="color"
              [value]="nextColor()"
              class="w-8 h-8 shrink-0 rounded cursor-pointer border-0 bg-transparent p-0"
              aria-label="Color de la nueva categoría"
            />
            <input
              type="text"
              name="name"
              maxlength="40"
              placeholder="Nueva categoría"
              [class]="inputClass + ' flex-1 min-w-0'"
              [attr.aria-label]="'Nombre de la nueva categoría de ' + group.title.toLowerCase()"
            />
            <button type="submit" [class]="buttonClass">Agregar</button>
          </form>
        </section>
      }
    </main>
  `,
})
export class CategoriesComponent {
  private readonly tx = inject(TransactionService);
  private readonly budgets = inject(BudgetService);
  private readonly recurring = inject(RecurringService);

  protected readonly buttonClass = BUTTON;
  protected readonly inputClass = INPUT;
  protected readonly error = signal<string | null>(null);
  protected readonly pendingDelete = signal<PendingDelete | null>(null);

  protected readonly groups = computed<Group[]>(() => {
    const categories = this.tx.categories();
    return [
      { type: 'expense', title: 'Gastos', categories: categories.filter(c => c.type === 'expense') },
      { type: 'income', title: 'Ingresos', categories: categories.filter(c => c.type === 'income') },
    ];
  });

  protected readonly nextColor = computed(() => unusedColor(this.tx.categories()));

  protected usageLabel(category: Category): string {
    const usage = this.tx.categoryUsage(category.id);
    return usage === 1 ? '1 transacción' : `${usage} transacciones`;
  }

  protected recolor(category: Category, color: string): void {
    this.tx.updateCategory(category.id, { name: category.name, color });
  }

  protected rename(category: Category, input: HTMLInputElement): void {
    const name = input.value.trim();
    const problem = this.validateName(name, category.type, category.id);
    if (problem) {
      this.error.set(problem);
      input.value = category.name;
      return;
    }
    this.error.set(null);
    this.tx.updateCategory(category.id, { name, color: category.color });
  }

  protected add(event: Event, type: CategoryType): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const problem = this.validateName(name, type, null);
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.error.set(null);
    this.tx.addCategory({ name, type, color: String(data.get('color')) });
    form.reset();
  }

  protected askDelete(category: Category): void {
    this.error.set(null);
    const transactions = this.tx.categoryUsage(category.id);
    const rules = this.recurring.categoryUsage(category.id);
    if (transactions === 0 && rules === 0) {
      this.delete(category.id, null);
      return;
    }
    const parts = [
      transactions > 0 ? (transactions === 1 ? '1 transacción' : `${transactions} transacciones`) : '',
      rules > 0 ? (rules === 1 ? '1 recurrente' : `${rules} recurrentes`) : '',
    ].filter(Boolean);
    const replacement = this.tx.categories().find(c => c.type === category.type && c.id !== category.id)!;
    this.pendingDelete.set({ category, usage: parts.join(' y '), replacementId: replacement.id });
  }

  protected setReplacement(replacementId: string): void {
    this.pendingDelete.update(pending => (pending ? { ...pending, replacementId } : pending));
  }

  protected confirmDelete(): void {
    const pending = this.pendingDelete();
    if (!pending) return;
    this.delete(pending.category.id, pending.replacementId);
    this.pendingDelete.set(null);
  }

  private delete(id: string, replacementId: string | null): void {
    try {
      this.tx.removeCategory(id, replacementId);
      if (replacementId) this.recurring.reassignCategory(id, replacementId);
      this.budgets.setLimit(id, null);
    } catch (error) {
      this.error.set((error as Error).message);
    }
  }

  private validateName(name: string, type: CategoryType, ownId: string | null): string | null {
    if (!name) return 'El nombre no puede quedar vacío.';
    const taken = this.tx.categories().some(
      c => c.type === type && c.id !== ownId && c.name.toLowerCase() === name.toLowerCase()
    );
    return taken ? `Ya existe una categoría llamada «${name}».` : null;
  }
}
