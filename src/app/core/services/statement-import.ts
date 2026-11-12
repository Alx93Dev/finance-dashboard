import { Transaction } from '../models/transaction.model';

/** Which column holds each field; -1 when the statement has no such column. */
export interface ColumnMapping {
  date: number;
  description: number;
  /** Signed amount: positive is income, negative is an expense. */
  amount: number;
  /** Money out, as a positive number. */
  debit: number;
  /** Money in, as a positive number. */
  credit: number;
  /** Category name; rows without one use the category picked for all. */
  category?: number;
  /** Running balance; with an unsigned amount it tells whether money came in or out. */
  balance?: number;
}

export interface ReadOptions {
  /**
   * Positive amounts are charges, as in credit card statements, where a
   * purchase adds to what you owe and a payment shows as negative.
   */
  positiveIsExpense?: boolean;
}

export interface StatementRow {
  date: string;
  description: string;
  amount: number;
  type: Transaction['type'];
  /** Category name from the file, when it has one. */
  category?: string;
}

export interface ParsedStatement {
  rows: StatementRow[];
  /** Lines with data that could not be read (bad date, no amount, ...). */
  skipped: number;
}

export const NO_COLUMN = -1;

/** Splits CSV text into rows, guessing whether fields are separated by commas or semicolons. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  // Look past title lines above the table, which often have no separators.
  const head = clean.split(/\r?\n/, 10).join('\n');
  const delimiter = (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i++;
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows.filter(r => r.some(cell => cell !== ''));
}

/** Lowercase without accents, for comparing names. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Guesses the columns from the header names that Chilean banks commonly use. */
export function detectColumns(header: string[]): ColumnMapping {
  const names = header.map(normalize);
  const find = (...words: string[]) => names.findIndex(name => words.some(word => name.includes(word)));
  return {
    date: find('fecha'),
    description: find('descripcion', 'glosa', 'detalle', 'concepto', 'movimiento'),
    amount: find('monto', 'importe'),
    debit: find('cargo', 'debito', 'giro', 'egreso'),
    credit: find('abono', 'credito', 'deposito', 'ingreso'),
    category: find('categoria'),
    balance: find('saldo'),
  };
}

/**
 * Index of the header row: banks often put the account holder and period
 * above it. Falls back to the first row.
 */
export function findHeaderRow(rows: string[][]): number {
  // Summary lines such as "Monto facturado | ... | Fecha de inicio" also name a
  // date and an amount, so prefer the candidate whose following rows hold dates.
  let best = -1;
  let bestScore = -1;
  rows.forEach((row, index) => {
    const mapping = detectColumns(row);
    const hasAmount = mapping.amount !== NO_COLUMN || mapping.debit !== NO_COLUMN || mapping.credit !== NO_COLUMN;
    if (mapping.date === NO_COLUMN || !hasAmount) return;
    const score = rows.slice(index + 1, index + 6).filter(next => parseStatementDate(next[mapping.date] ?? '')).length;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return Math.max(best, 0);
}

/** Whether the lines above the table, or the table header, say it is a credit card statement. */
export function looksLikeCreditCard(rows: string[][], headerIndex: number): boolean {
  return rows.slice(0, headerIndex + 1).some(row =>
    row.some(cell => /tarjeta de credito|tipo de tarjeta|facturad/.test(normalize(cell)))
  );
}

/** Whether every amount in the column is zero or more, so the sign has to come from elsewhere. */
export function hasOnlyPositiveAmounts(rows: string[][], column: number): boolean {
  const amounts = rows.map(row => parseStatementAmount(row[column] ?? '')).filter((n): n is number => n !== null);
  return amounts.length > 0 && amounts.every(n => n >= 0);
}

/** Reads dd/mm/yyyy, dd-mm-yyyy, dd/mm/yy or yyyy-mm-dd as 'YYYY-MM-DD'; null otherwise. */
export function parseStatementDate(text: string): string | null {
  const value = text.trim();
  let year: number, month: number, day: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  if (match) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(value);
    if (!match) return null;
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (year < 100) year += 2000;
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Reads an amount written the Chilean way ("$ -12.345", "1.234,50") or with a
 * plain decimal point ("-12345.5"). Returns null for empty or unreadable text.
 */
export function parseStatementAmount(text: string): number | null {
  let value = text.replace(/[$\s]|CLP/gi, '');
  if (!value) return null;
  const negative = /^-|^\(.*\)$|-$/.test(value);
  value = value.replace(/[()+-]/g, '');
  if (/,\d{1,2}$/.test(value)) {
    value = value.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value) || /^\d{1,3}(,\d{3})+$/.test(value)) {
    value = value.replace(/[.,]/g, '');
  } else {
    value = value.replace(/,/g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const amount = Number(value);
  return negative ? -amount : amount;
}

/** Turns the data rows of a statement into transactions to import, using `mapping`. */
export function readStatement(rows: string[][], mapping: ColumnMapping, options: ReadOptions = {}): ParsedStatement {
  const result: StatementRow[] = [];
  let skipped = 0;
  const cell = (row: string[], index: number) => (index === NO_COLUMN ? '' : row[index] ?? '');
  const balanceSigns = mapping.amount !== NO_COLUMN && (mapping.balance ?? NO_COLUMN) !== NO_COLUMN
    ? signsFromBalance(rows, mapping, cell)
    : null;

  rows.forEach((row, index) => {
    const date = parseStatementDate(cell(row, mapping.date));
    let signed: number | null = null;
    if (balanceSigns) {
      const amount = parseStatementAmount(cell(row, mapping.amount));
      signed = amount === null ? null : Math.abs(amount) * balanceSigns[index];
    } else if (mapping.amount !== NO_COLUMN) {
      signed = parseStatementAmount(cell(row, mapping.amount));
      if (signed !== null && options.positiveIsExpense) {
        // Some card statements (BCI's PDF) also print payments as positive amounts.
        const payment = signed > 0 && CARD_PAYMENT_WORDS.test(normalize(cell(row, mapping.description)).trim());
        signed = payment ? signed : -signed;
      }
    } else {
      const credit = parseStatementAmount(cell(row, mapping.credit));
      const debit = parseStatementAmount(cell(row, mapping.debit));
      if (credit) signed = Math.abs(credit);
      else if (debit) signed = -Math.abs(debit);
    }
    if (!date || !signed) {
      skipped++;
      return;
    }
    const parsed: StatementRow = {
      date,
      description: cell(row, mapping.description).replace(/\s+/g, ' ').trim() || 'Movimiento importado',
      amount: Math.round(Math.abs(signed)),
      type: signed > 0 ? 'income' : 'expense',
    };
    const category = cell(row, mapping.category ?? NO_COLUMN).trim();
    if (category) parsed.category = category;
    result.push(parsed);
  });
  return { rows: result, skipped };
}

/** Card statement lines that are a payment or a refund, not a purchase. */
const CARD_PAYMENT_WORDS = /^(monto cancelado|pago recibido|abono|reverso|devolucion)/;

/** Words that mark money coming in, for rows whose sign the balance can't tell. */
const INCOME_WORDS = /^(abono|deposito|transfer(encia)? (de|recibida)|traspaso desde)/;

/**
 * Sign of each row (1 income, -1 expense) when the amount column has no sign
 * but there is a running balance: the change from the previous movement's
 * balance gives it. Works whether the newest movement is first or last.
 */
function signsFromBalance(rows: string[][], mapping: ColumnMapping, cell: (row: string[], index: number) => string): number[] {
  const amounts = rows.map(row => parseStatementAmount(cell(row, mapping.amount)));
  const balances = rows.map(row => parseStatementAmount(cell(row, mapping.balance ?? NO_COLUMN)));
  // The previous movement is the next row when the newest comes first, else the row before.
  const signFrom = (index: number, previous: number): number | null => {
    const amount = amounts[index];
    const balance = balances[index];
    const before = balances[previous];
    if (amount === null || balance === null || before === null || before === undefined || amount === 0) return null;
    const change = balance - before;
    return Math.abs(Math.abs(change) - Math.abs(amount)) < 0.005 ? Math.sign(change) : null;
  };
  const matches = (step: number) => rows.filter((_, i) => signFrom(i, i + step) !== null).length;
  const step = matches(1) >= matches(-1) ? 1 : -1;

  return rows.map((row, index) => {
    const sign = signFrom(index, index + step);
    if (sign !== null) return sign;
    return INCOME_WORDS.test(normalize(cell(row, mapping.description)).trim()) ? 1 : -1;
  });
}

/** Same day, amount, type and description (ignoring case and spacing): likely the same movement. */
export function isSameMovement(a: Pick<Transaction, 'date' | 'amount' | 'type' | 'description'>, b: typeof a): boolean {
  const text = (value: string) => normalize(value).replace(/\s+/g, ' ').trim();
  return a.date === b.date && a.amount === b.amount && a.type === b.type && text(a.description) === text(b.description);
}
