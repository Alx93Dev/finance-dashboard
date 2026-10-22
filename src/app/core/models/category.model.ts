export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
}

/** Colors offered for new categories, in order. */
export const CATEGORY_PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6b7280'];

/** First palette color no category uses yet, or the first one when all are taken. */
export function unusedColor(categories: Category[]): string {
  const used = new Set(categories.map(c => c.color.toLowerCase()));
  return CATEGORY_PALETTE.find(color => !used.has(color)) ?? CATEGORY_PALETTE[0];
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Sueldo',          type: 'income',  color: '#10b981' },
  { id: '2', name: 'Freelance',       type: 'income',  color: '#3b82f6' },
  { id: '3', name: 'Alimentación',    type: 'expense', color: '#f59e0b' },
  { id: '4', name: 'Transporte',      type: 'expense', color: '#ef4444' },
  { id: '5', name: 'Entretenimiento', type: 'expense', color: '#8b5cf6' },
  { id: '6', name: 'Salud',           type: 'expense', color: '#06b6d4' },
  { id: '7', name: 'Vivienda',        type: 'expense', color: '#f97316' },
  { id: '8', name: 'Otros',           type: 'expense', color: '#6b7280' },
];
