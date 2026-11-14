import { PdfMark, PdfText, markDirection, pdfTableRows } from './statement-pdf';

/** A text run of height 8 whose width is about 4 per character. */
function at(x: number, y: number, text: string): PdfText {
  return { text, x, y, width: text.length * 4, height: 8 };
}

// Laid out like a BCI checking account statement: y grows upwards.
const PAGE: PdfText[] = [
  at(270, 780, 'CARTOLA DE CUENTA CORRIENTE'),
  at(360, 752, 'CHEQUES Y'),
  at(48, 740, 'FECHA'), at(99, 740, 'SUCURSAL'), at(192, 740, 'DESCRIPCION'), at(297, 740, 'DOCUMENTO'),
  at(371, 740, 'CARGOS'), at(438, 740, 'Y'), at(446, 740, 'ABONOS'), at(508, 740, 'SALDO'), at(532, 740, 'DIARIO'),
  // Description wrapped above and below the date line.
  at(152, 727, 'PAGO TARJETA DE CREDITO'),
  at(44, 723, '05/10/2026'), at(99, 723, 'OF CENTRA'), at(319, 723, '18'), at(398, 723, '12.640'), at(557, 723, '26.244'),
  at(152, 719, 'MASTERCARD'),
  // One line.
  at(44, 712, '07/10/2026'), at(99, 712, 'OF CENTRA'), at(152, 712, 'TRANSFER DE'), at(198, 712, 'A.CASTILLO LO'),
  at(311, 712, '9097314'), at(472, 712, '20.440'), at(557, 712, '46.684'),
  // Description that continues on the line below, with a short word.
  at(44, 701, '08/10/2026'), at(99, 701, 'OF CENTRA'), at(152, 701, 'TRASPASO FONDOS OTRO BANCO EN'),
  at(304, 701, '1481826588'), at(402, 701, '8.000'), at(557, 701, '38.684'),
  at(152, 697, 'LINEA'),
  at(44, 670, 'Resumen del Periodo'),
  at(44, 660, '22-09-2026 al 02-'), at(400, 660, '2.812.372'),
];

describe('pdfTableRows', () => {
  it('should rebuild the movements table from the text positions', () => {
    expect(pdfTableRows([PAGE])).toEqual([
      ['CARTOLA DE CUENTA CORRIENTE'],
      ['CHEQUES Y'],
      ['FECHA', 'SUCURSAL', 'DESCRIPCION', 'DOCUMENTO', 'CARGOS', 'Y ABONOS', 'SALDO DIARIO'],
      ['05/10/2026', 'OF CENTRA', 'PAGO TARJETA DE CREDITO MASTERCARD', '18', '12.640', '', '26.244'],
      ['07/10/2026', 'OF CENTRA', 'TRANSFER DE A.CASTILLO LO', '9097314', '', '20.440', '46.684'],
      ['08/10/2026', 'OF CENTRA', 'TRASPASO FONDOS OTRO BANCO EN LINEA', '1481826588', '8.000', '', '38.684'],
    ]);
  });

  it('should keep reading on later pages and print the header once', () => {
    const second = [
      at(48, 740, 'FECHA'), at(192, 740, 'DESCRIPCION'), at(371, 740, 'CARGOS'), at(446, 740, 'ABONOS'),
      at(44, 723, '09/10/2026'), at(152, 723, 'COMPRA'), at(398, 723, '1.000'),
    ];
    const first = [
      at(48, 740, 'FECHA'), at(192, 740, 'DESCRIPCION'), at(371, 740, 'CARGOS'), at(446, 740, 'ABONOS'),
      at(44, 723, '08/10/2026'), at(152, 723, 'ABONO'), at(472, 723, '5.000'),
    ];
    expect(pdfTableRows([first, second])).toEqual([
      ['FECHA', 'DESCRIPCION', 'CARGOS', 'ABONOS'],
      ['08/10/2026', 'ABONO', '', '5.000'],
      ['09/10/2026', 'COMPRA', '1.000', ''],
    ]);
  });

  it('should not take a summary line with a date for the header', () => {
    const page = [
      at(20, 760, 'Monto facturado:'), at(150, 760, '$ 687.185'), at(300, 760, 'Fecha de inicio:'), at(450, 760, '21/8/2026'),
      at(20, 740, 'Fecha'), at(100, 740, 'Código'), at(200, 740, 'Descripción'), at(450, 740, 'Monto'),
      at(16, 723, '17/9/2026'), at(100, 723, '1709 0000994'), at(200, 723, 'MONTO CANCELADO'), at(440, 723, '$ 40.000'),
    ];
    expect(pdfTableRows([page]).slice(1)).toEqual([
      ['Fecha', 'Código', 'Descripción', 'Monto'],
      ['17/9/2026', '1709 0000994', 'MONTO CANCELADO', '$ 40.000'],
    ]);
  });

  it('should put a minus sign on amounts with a money-in arrow', () => {
    // BCI card statement: a green arrow (in) beside payments, orange (out) beside charges.
    const page = [
      at(20, 740, 'Fecha'), at(200, 740, 'Descripción'), at(450, 740, 'Monto'),
      at(16, 723, '29/10/2026'), at(200, 723, 'MONTO CANCELAD'), at(440, 723, '$ 484.237'),
      at(16, 700, '29/10/2026'), at(200, 700, 'AVANCE EN 4 CUOT A'), at(440, 700, '$ 171.845'),
      at(16, 677, '22/10/2026'), at(200, 677, 'NOTA DE CREDITO NACIONA'), at(440, 677, '$ 40.491'),
    ];
    const arrow = (y: number, direction: PdfMark['direction']): PdfMark => ({ x: 490, y, width: 8, height: 8, direction });
    expect(pdfTableRows([page], [[arrow(723, 'in'), arrow(700, 'out'), arrow(676, 'in')]]).slice(1)).toEqual([
      ['29/10/2026', 'MONTO CANCELAD', '-$ 484.237'],
      ['29/10/2026', 'AVANCE EN 4 CUOT A', '$ 171.845'],
      ['22/10/2026', 'NOTA DE CREDITO NACIONA', '-$ 40.491'],
    ]);
  });

  it('should return nothing useful for a page without a table', () => {
    expect(pdfTableRows([[at(10, 10, 'Hola')]])).toEqual([['Hola']]);
  });
});

describe('markDirection', () => {
  const pixels = (rgb: number[], count: number, alpha?: number) =>
    new Uint8Array(Array.from({ length: count }, () => (alpha === undefined ? rgb : [...rgb, alpha])).flat());

  it('should read green as money in and orange as a charge', () => {
    expect(markDirection(pixels([83, 161, 86], 10), 3)).toBe('in');
    expect(markDirection(pixels([247, 135, 40], 10, 255), 4)).toBe('out');
  });

  it('should ignore transparent, white and gray pixels', () => {
    expect(markDirection(pixels([83, 161, 86], 10, 0), 4)).toBeNull();
    expect(markDirection(pixels([255, 255, 255], 10), 3)).toBeNull();
    expect(markDirection(pixels([120, 120, 120], 10), 3)).toBeNull();
  });
});
