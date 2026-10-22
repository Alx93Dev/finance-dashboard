import { Injectable, inject, signal } from '@angular/core';
import { Goal } from '../models/goal.model';
import { StorageService } from './storage.service';

const STORAGE_KEY = 'goals';

export interface GoalProgress {
  /** saved / target, capped at 1. */
  ratio: number;
  remaining: number;
  done: boolean;
  /** The deadline has passed without reaching the target. */
  overdue: boolean;
  /** What to save each month to reach the target by the deadline; null without one. */
  monthlyNeeded: number | null;
}

function localDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Months from `today` to `deadline`, counting the current month; at least 1. */
function monthsUntil(deadline: string, today: string): number {
  const months = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  return Math.max(1, months(deadline) - months(today) + 1);
}

export function goalProgress(goal: Goal, now = new Date()): GoalProgress {
  const remaining = Math.max(0, goal.target - goal.saved);
  const done = remaining === 0;
  const today = localDate(now);
  const overdue = !done && !!goal.deadline && goal.deadline < today;
  const monthlyNeeded = !done && goal.deadline && !overdue
    ? Math.ceil(remaining / monthsUntil(goal.deadline, today))
    : null;
  return { ratio: Math.min(1, goal.saved / goal.target), remaining, done, overdue, monthlyNeeded };
}

@Injectable({ providedIn: 'root' })
export class GoalService {
  private readonly storage = inject(StorageService);

  readonly goals = signal<Goal[]>(this.storage.get<Goal[]>(STORAGE_KEY, []));

  add(goal: Pick<Goal, 'name' | 'target' | 'deadline'>): Goal {
    const created: Goal = { ...goal, id: crypto.randomUUID(), saved: 0 };
    this.setGoals([...this.goals(), created]);
    return created;
  }

  update(id: string, changes: Pick<Goal, 'name' | 'target' | 'deadline'>): void {
    this.setGoals(this.goals().map(g => (g.id === id ? { ...g, ...changes } : g)));
  }

  remove(id: string): void {
    this.setGoals(this.goals().filter(g => g.id !== id));
  }

  /** Adds money to a goal; a negative amount withdraws it, never below zero. */
  contribute(id: string, amount: number): void {
    this.setGoals(this.goals().map(g => (g.id === id ? { ...g, saved: Math.max(0, g.saved + amount) } : g)));
  }

  /** Replaces every stored goal, e.g. when restoring a backup. */
  replaceAll(goals: Goal[]): void {
    this.setGoals(goals);
  }

  private setGoals(goals: Goal[]): void {
    this.goals.set(goals);
    this.storage.set(STORAGE_KEY, goals);
  }
}
