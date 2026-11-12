import { BillingCycle } from '../models/account.model';

/** Days from the day after one closing to the next closing, both inclusive. */
export interface BillingPeriod {
  /** Month the period closes in, as 'YYYY-MM'; it names the period. */
  month: string;
  /** First day, 'YYYY-MM-DD'. */
  start: string;
  /** Closing day, 'YYYY-MM-DD'. */
  end: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, '0');

function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** 'YYYY-MM' moved by some months. */
export function shiftMonth(month: string, months: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + months, 1));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
}

/** Whether a value is a usable closing day of the month. */
export function isClosingDay(day: unknown): day is number {
  return typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 31;
}

/** Whether a string is a real calendar date as 'YYYY-MM-DD'. */
export function isDate(date: unknown): date is string {
  return typeof date === 'string' && DATE.test(date) && addDays(date, 0) === date;
}

/** Day the statement closed, or will close, in a month: the date given for it, or the usual day. */
export function closingDate(cycle: BillingCycle, month: string): string {
  const given = cycle.closings?.find(date => date.startsWith(month));
  return given ?? `${month}-${pad(Math.min(cycle.closingDay, daysInMonth(month)))}`;
}

/** The period that closes in a month. */
export function periodClosingIn(cycle: BillingCycle, month: string): BillingPeriod {
  return { month, start: addDays(closingDate(cycle, shiftMonth(month, -1)), 1), end: closingDate(cycle, month) };
}

/** The period a day is billed in. */
export function periodOf(cycle: BillingCycle, date: string): BillingPeriod {
  const month = date.slice(0, 7);
  return date <= closingDate(cycle, month) ? periodClosingIn(cycle, month) : periodClosingIn(cycle, shiftMonth(month, 1));
}

/** Every period from the one holding `first` to the one holding `last`, most recent first. */
export function periodsBetween(cycle: BillingCycle, first: string, last: string): BillingPeriod[] {
  const [from, to] = first <= last ? [first, last] : [last, first];
  const oldest = periodOf(cycle, from).month;
  const periods: BillingPeriod[] = [];
  for (let month = periodOf(cycle, to).month; month >= oldest; month = shiftMonth(month, -1)) {
    periods.push(periodClosingIn(cycle, month));
  }
  return periods;
}

/**
 * The cycle with a statement that closed on `date`, replacing any other
 * closing given for that month. The date is kept even on the usual day, so
 * changing the usual day later doesn't move periods that already closed.
 */
export function withClosing(cycle: BillingCycle, date: string): BillingCycle {
  const month = date.slice(0, 7);
  const closings = [...(cycle.closings ?? []).filter(d => !d.startsWith(month)), date].sort();
  return { closingDay: cycle.closingDay, closings };
}

/** A stored or restored cycle, or undefined when it is damaged. Unreadable closing dates are dropped. */
export function parseBillingCycle(value: unknown): BillingCycle | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (!isClosingDay(raw['closingDay'])) return undefined;
  const dates = Array.isArray(raw['closings']) ? raw['closings'].filter(isDate) : [];
  // Keep one date per month, the last one given.
  const byMonth = new Map(dates.map(date => [date.slice(0, 7), date]));
  const closings = [...byMonth.values()].sort();
  return closings.length > 0 ? { closingDay: raw['closingDay'], closings } : { closingDay: raw['closingDay'] };
}
