import { StatementFileError, decodeText, isDateFormat, readStatementFile } from './statement-file';
import { ACCOUNT_XLS, CARD_XLSX } from './statement-file.fixtures';

function blob(base64: string): Blob {
  return new Blob([Uint8Array.from(atob(base64), char => char.charCodeAt(0))]);
}

describe('readStatementFile', () => {
  it('should read an .xlsx with shared strings, numbers and date cells', async () => {
    expect(await readStatementFile(blob(CARD_XLSX))).toEqual([
      ['Detalle movimientos Tarjeta de Crédito'],
      ['Monto facturado', '50000', '', 'Fecha de inicio', '21/8/2026'],
      ['Fecha', 'Código referencia', 'Descripción', 'Monto ($)'],
      ['17-09-2026', '1709 1', 'MONTO CANCELADO', '-40000'],
      ['2026-09-16', '1709 2', 'LIBRERIA  SANTIAGO', '12990.5'],
    ]);
  });

  it('should read an old .xls workbook', async () => {
    const rows = await readStatementFile(blob(ACCOUNT_XLS));
    expect(rows[2]).toEqual(['Fecha', 'Descripción', 'Serie', 'Monto $', 'Saldo Contable $']);
    expect(rows[3]).toEqual(['20-10-2026', 'COMPRA CAFE', '1', '1390', '8841']);
    expect(rows.at(-1)).toEqual(['2026-10-16', 'Café Ñuñoa', '', '500.25']);
    expect(rows).toHaveLength(8);
  });

  it('should read an HTML table saved as .xls', async () => {
    const html = '<html><body><table><tr><th>Fecha</th><th>Monto</th></tr><tr><td>01/02/2025</td><td> -1.000 </td></tr></table></body></html>';
    expect(await readStatementFile(new Blob([html]))).toEqual([['Fecha', 'Monto'], ['01/02/2025', '-1.000']]);
  });

  it('should read CSV in Windows-1252', async () => {
    const bytes = new Uint8Array([...new TextEncoder().encode('Fecha;Descripci'), 0xf3, ...new TextEncoder().encode('n\n')]);
    expect(await readStatementFile(new Blob([bytes]))).toEqual([['Fecha', 'Descripción']]);
  });

  it('should explain a damaged Excel file', async () => {
    await expect(readStatementFile(new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])]))).rejects.toBeInstanceOf(StatementFileError);
  });
});

describe('decodeText', () => {
  it('should keep UTF-8 text', () => {
    expect(decodeText(new TextEncoder().encode('Categoría'))).toBe('Categoría');
  });
});

describe('isDateFormat', () => {
  it('should tell dates from numbers and times', () => {
    expect(isDateFormat('dd/mm/yyyy')).toBe(true);
    expect(isDateFormat('[$-409]d-mmm-yy;@')).toBe(true);
    expect(isDateFormat('#,##0;[Red]-#,##0')).toBe(false);
    expect(isDateFormat('"$"#,##0')).toBe(false);
    expect(isDateFormat('h:mm')).toBe(false);
  });
});
