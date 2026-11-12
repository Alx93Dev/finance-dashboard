import {
  NO_COLUMN,
  detectColumns,
  findHeaderRow,
  hasOnlyPositiveAmounts,
  isSameMovement,
  looksLikeCreditCard,
  parseCsv,
  parseStatementAmount,
  parseStatementDate,
  readStatement,
} from './statement-import';

describe('parseCsv', () => {
  it('should split comma separated rows with quoted fields', () => {
    expect(parseCsv('Fecha,Detalle,Monto\r\n01/02/2025,"Cena ""especial"", 2","-45.000"\r\n')).toEqual([
      ['Fecha', 'Detalle', 'Monto'],
      ['01/02/2025', 'Cena "especial", 2', '-45.000'],
    ]);
  });

  it('should detect semicolons and skip blank lines', () => {
    expect(parseCsv('﻿Fecha;Glosa;Cargo;Abono\n\n05-01-2025;Supermercado;12.990;\n')).toEqual([
      ['Fecha', 'Glosa', 'Cargo', 'Abono'],
      ['05-01-2025', 'Supermercado', '12.990', ''],
    ]);
  });
});

describe('detectColumns', () => {
  it('should recognize common Chilean bank headers', () => {
    expect(detectColumns(['Fecha', 'N° Documento', 'Descripción', 'Cargos ($)', 'Abonos ($)', 'Saldo'])).toEqual({
      date: 0, description: 2, amount: NO_COLUMN, debit: 3, credit: 4, category: NO_COLUMN, balance: 5,
    });
    expect(detectColumns(['FECHA', 'GLOSA', 'MONTO'])).toEqual({
      date: 0, description: 1, amount: 2, debit: NO_COLUMN, credit: NO_COLUMN, category: NO_COLUMN, balance: NO_COLUMN,
    });
  });

  it('should find the header below the account details', () => {
    const rows = [['Cuenta Corriente', '123-45'], ['Período', 'Enero 2025'], ['Fecha', 'Detalle', 'Monto'], ['01/01/2025', 'x', '1']];
    expect(findHeaderRow(rows)).toBe(2);
    expect(findHeaderRow([['a', 'b']])).toBe(0);
  });

  it('should skip summary lines that also name a date and an amount', () => {
    const rows = [
      ['Monto facturado', '687185', '', 'Fecha de inicio', '21/8/2026'],
      ['Pago mínimo', '0', '', 'Fecha facturación', '17/9/2026'],
      ['Fecha', 'Código', 'Descripción', 'Monto ($)'],
      ['17-09-2026', '1', 'MONTO CANCELADO', '-40000'],
    ];
    expect(findHeaderRow(rows)).toBe(2);
  });
});

describe('looksLikeCreditCard', () => {
  it('should notice a credit card statement from the lines above the table', () => {
    expect(looksLikeCreditCard([['Detalle movimientos Tarjeta de Crédito'], ['Fecha', 'Monto']], 1)).toBe(true);
    expect(looksLikeCreditCard([['Cartola cuenta corriente'], ['Fecha', 'Monto']], 1)).toBe(false);
  });
});

describe('hasOnlyPositiveAmounts', () => {
  it('should tell whether an amount column carries no sign', () => {
    expect(hasOnlyPositiveAmounts([['1.390'], ['10.000'], ['']], 0)).toBe(true);
    expect(hasOnlyPositiveAmounts([['1.390'], ['-10.000']], 0)).toBe(false);
  });
});

describe('parseStatementDate', () => {
  it('should read the usual formats', () => {
    expect(parseStatementDate('05/01/2025')).toBe('2025-01-05');
    expect(parseStatementDate('5-1-25')).toBe('2025-01-05');
    expect(parseStatementDate('2025-01-05')).toBe('2025-01-05');
    expect(parseStatementDate('05.01.2025')).toBe('2025-01-05');
  });

  it('should reject dates that do not exist or are not dates', () => {
    expect(parseStatementDate('31/02/2025')).toBeNull();
    expect(parseStatementDate('Saldo inicial')).toBeNull();
    expect(parseStatementDate('')).toBeNull();
  });
});

describe('parseStatementAmount', () => {
  it('should read Chilean thousands separators, signs and decimals', () => {
    expect(parseStatementAmount('$ 1.234.567')).toBe(1234567);
    expect(parseStatementAmount('-12.990')).toBe(-12990);
    expect(parseStatementAmount('(5.000)')).toBe(-5000);
    expect(parseStatementAmount('1.234,50')).toBe(1234.5);
    expect(parseStatementAmount('12990')).toBe(12990);
    expect(parseStatementAmount('-12345.5')).toBe(-12345.5);
    expect(parseStatementAmount('1,234,567')).toBe(1234567);
  });

  it('should return null for empty or unreadable text', () => {
    expect(parseStatementAmount('')).toBeNull();
    expect(parseStatementAmount('  ')).toBeNull();
    expect(parseStatementAmount('n/a')).toBeNull();
  });
});

describe('readStatement', () => {
  it('should flip the sign for credit card statements', () => {
    const rows = [['17/09/2026', 'MONTO CANCELADO', '-40.000'], ['16/09/2026', 'LIBRERIA   SANTIAGO', '12.990']];
    const mapping = { date: 0, description: 1, amount: 2, debit: NO_COLUMN, credit: NO_COLUMN };
    expect(readStatement(rows, mapping, { positiveIsExpense: true }).rows).toEqual([
      { date: '2026-09-17', description: 'MONTO CANCELADO', amount: 40000, type: 'income' },
      { date: '2026-09-16', description: 'LIBRERIA SANTIAGO', amount: 12990, type: 'expense' },
    ]);
  });

  it('should read payments printed as positive amounts in a card statement as income', () => {
    const rows = [['17/09/2026', 'MONTO CANCELADO', '$ 40.000'], ['16/09/2026', 'LIBRERIA', '$ 12.990']];
    const mapping = { date: 0, description: 1, amount: 2, debit: NO_COLUMN, credit: NO_COLUMN };
    expect(readStatement(rows, mapping, { positiveIsExpense: true }).rows.map(r => r.type)).toEqual(['income', 'expense']);
  });

  it('should take the sign of an unsigned amount from the balance, newest first or last', () => {
    const newestFirst = [
      ['20/10/2026', 'Compra', '1.390', '8.841'],
      ['19/10/2026', 'Transfer de Juan', '40.000', '10.231'],
      ['18/10/2026', 'Pago tarjeta', '10.000', '-29.769'],
      ['17/10/2026', 'Abono cashback', '102', '-19.769'],
      ['16/10/2026', 'Pago luz', '500', '-19.871'],
    ];
    const mapping = { date: 0, description: 1, amount: 2, debit: NO_COLUMN, credit: NO_COLUMN, balance: 3 };
    const types = (rows: string[][]) => readStatement(rows, mapping).rows.map(r => `${r.description}:${r.type}`);
    const expected = ['Compra:expense', 'Transfer de Juan:income', 'Pago tarjeta:expense', 'Abono cashback:income', 'Pago luz:expense'];
    expect(types(newestFirst)).toEqual(expected);
    expect(types([...newestFirst].reverse())).toEqual([...expected].reverse());
  });

  it('should use the sign of a single amount column', () => {
    const rows = [['01/01/2025', 'Sueldo', '1.200.000'], ['02/01/2025', 'Uber', '-8.500'], ['Total', '', '1.191.500']];
    expect(readStatement(rows, { date: 0, description: 1, amount: 2, debit: NO_COLUMN, credit: NO_COLUMN })).toEqual({
      rows: [
        { date: '2025-01-01', description: 'Sueldo', amount: 1200000, type: 'income' },
        { date: '2025-01-02', description: 'Uber', amount: 8500, type: 'expense' },
      ],
      skipped: 1,
    });
  });

  it('should read separate debit and credit columns', () => {
    const rows = [['05/01/2025', 'Supermercado', '12.990', ''], ['06/01/2025', 'Transferencia recibida', '', '50.000'], ['07/01/2025', 'Sin monto', '', '']];
    expect(readStatement(rows, { date: 0, description: 1, amount: NO_COLUMN, debit: 2, credit: 3 })).toEqual({
      rows: [
        { date: '2025-01-05', description: 'Supermercado', amount: 12990, type: 'expense' },
        { date: '2025-01-06', description: 'Transferencia recibida', amount: 50000, type: 'income' },
      ],
      skipped: 1,
    });
  });

  it('should name movements without a description', () => {
    const { rows } = readStatement([['01/01/2025', '-1000']], { date: 0, description: NO_COLUMN, amount: 1, debit: NO_COLUMN, credit: NO_COLUMN });
    expect(rows[0].description).toBe('Movimiento importado');
  });
});

describe('isSameMovement', () => {
  it('should ignore case, accents and spacing in the description', () => {
    const a = { date: '2025-01-05', amount: 12990, type: 'expense' as const, description: 'Café  Central' };
    expect(isSameMovement(a, { ...a, description: 'cafe central' })).toBe(true);
    expect(isSameMovement(a, { ...a, amount: 12991 })).toBe(false);
    expect(isSameMovement(a, { ...a, date: '2025-01-06' })).toBe(false);
  });
});
