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
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

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
  };
}

/**
 * Index of the header row: banks often put the account holder and period
 * above it. Falls back to the first row.
 */
export function findHeaderRow(rows: string[][]): number {
  const index = rows.findIndex(row => {
    const mapping = detectColumns(row);
    return mapping.date !== NO_COLUMN &&
      (mapping.amount !== NO_COLUMN || mapping.debit !== NO_COLUMN || mapping.credit !== NO_COLUMN);
  });
  return Math.max(index, 0);
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
export function readStatement(rows: string[][], mapping: ColumnMapping): ParsedStatement {
  const result: StatementRow[] = [];
  let skipped = 0;
  const cell = (row: string[], index: number) => (index === NO_COLUMN ? '' : row[index] ?? '');

  for (const row of rows) {
    const date = parseStatementDate(cell(row, mapping.date));
    let signed: number | null = null;
    if (mapping.amount !== NO_COLUMN) {
      signed = parseStatementAmount(cell(row, mapping.amount));
    } else {
      const credit = parseStatementAmount(cell(row, mapping.credit));
      const debit = parseStatementAmount(cell(row, mapping.debit));
      if (credit) signed = Math.abs(credit);
      else if (debit) signed = -Math.abs(debit);
    }
    if (!date || !signed) {
      skipped++;
      continue;
    }
    const parsed: StatementRow = {
      date,
      description: cell(row, mapping.description) || 'Movimiento importado',
      amount: Math.round(Math.abs(signed)),
      type: signed > 0 ? 'income' : 'expense',
    };
    const category = cell(row, mapping.category ?? NO_COLUMN).trim();
    if (category) parsed.category = category;
    result.push(parsed);
  }
  return { rows: result, skipped };
}

/** Same day, amount, type and description (ignoring case and spacing): likely the same movement. */
export function isSameMovement(a: Pick<Transaction, 'date' | 'amount' | 'type' | 'description'>, b: typeof a): boolean {
  const text = (value: string) => normalize(value).replace(/\s+/g, ' ').trim();
  return a.date === b.date && a.amount === b.amount && a.type === b.type && text(a.description) === text(b.description);
}
