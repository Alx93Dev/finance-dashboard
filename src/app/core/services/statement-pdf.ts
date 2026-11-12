import { normalize, parseStatementDate } from './statement-import';

/** A run of text on a PDF page; x and y are the bottom-left corner, y grows upwards. */
export interface PdfText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Phrase {
  text: string;
  start: number;
  end: number;
  y: number;
}

interface Column {
  center: number;
  label: string;
}

const HEADER_AMOUNT = /cargo|abono|monto|saldo|importe|debito|credito/;
/** Lines that end the movements table, such as the period summary. */
const TABLE_END = /^(resumen|total(es)? )/;

/**
 * Rebuilds the movements table of a statement PDF from the position of its
 * text, so it can go through the same column detection as a CSV:
 * - the header is the line with "Fecha" and an amount column; each phrase
 *   on it is a column, and text goes to the column whose header is nearest;
 * - a movement is a line that starts with a date;
 * - descriptions that wrap above or below that line join the closest movement.
 * Lines above the first header come out as they are, so the title (e.g.
 * "Tarjeta de crédito") is still there for the importer.
 */
export function pdfTableRows(pages: PdfText[][]): string[][] {
  const rows: string[][] = [];
  let columns: Column[] | null = null;
  let headerDone = false;

  for (const page of pages) {
    const lines = groupLines(page);
    let pageColumns: Column[] | null = null;
    let movements: { y: number; cells: string[][] }[] = [];
    // Where text starts in each column on movement lines; wrapped lines start at the same place.
    const starts: { start: number; column: number }[] = [];
    const loose: Phrase[] = [];
    let ended = false;

    for (const line of lines) {
      const header = headerColumns(line);
      if (header) {
        pageColumns = columns = header;
        if (!headerDone) {
          rows.push(header.map(c => c.label));
          headerDone = true;
        }
        continue;
      }
      const active = pageColumns ?? (headerDone ? columns : null);
      if (!active) {
        if (!headerDone) rows.push(line.map(p => p.text));
        continue;
      }
      if (ended) continue;
      if (TABLE_END.test(normalize(line[0].text))) {
        ended = true;
        continue;
      }
      const dateColumn = active.findIndex(c => normalize(c.label).startsWith('fecha'));
      const cells: string[][] = active.map(() => []);
      const placed = line.map(phrase => ({ phrase, column: columnOf(phrase, active) }));
      for (const { phrase, column } of placed) cells[column].push(phrase.text);
      if (parseStatementDate(cells[dateColumn]?.[0] ?? '')) {
        movements.push({ y: line[0].y, cells });
        for (const { phrase, column } of placed) starts.push({ start: phrase.start, column });
      } else {
        loose.push(...line);
      }
    }

    // Wrapped text belongs to the nearest movement, if it is closer than the gap between movements.
    if (movements.length > 0 && columns) {
      const gaps = movements.slice(1).map((m, i) => Math.abs(movements[i].y - m.y)).sort((a, b) => a - b);
      const spacing = gaps[Math.floor(gaps.length / 2)] ?? 12;
      const pieces = new Map<number, { y: number; column: number; text: string }[]>();
      for (const phrase of loose) {
        let nearest = 0;
        movements.forEach((m, i) => {
          if (Math.abs(m.y - phrase.y) < Math.abs(movements[nearest].y - phrase.y)) nearest = i;
        });
        if (Math.abs(movements[nearest].y - phrase.y) >= spacing * 0.75) continue;
        const list = pieces.get(nearest) ?? [];
        const aligned = starts.find(s => Math.abs(s.start - phrase.start) < 2);
        list.push({ y: phrase.y, column: aligned?.column ?? columnOf(phrase, columns), text: phrase.text });
        pieces.set(nearest, list);
      }
      movements = movements.map((movement, index) => {
        const extra = pieces.get(index) ?? [];
        const cells = movement.cells.map((texts, column) => {
          const parts = [
            ...extra.filter(p => p.column === column && p.y > movement.y).sort((a, b) => b.y - a.y).map(p => p.text),
            ...texts,
            ...extra.filter(p => p.column === column && p.y < movement.y).sort((a, b) => b.y - a.y).map(p => p.text),
          ];
          return parts;
        });
        return { ...movement, cells };
      });
      for (const movement of movements) rows.push(movement.cells.map(parts => parts.join(' ')));
    }
  }
  return rows;
}

/** Text runs grouped into lines, top to bottom, and joined into phrases when they are close together. */
function groupLines(items: PdfText[]): Phrase[][] {
  const sorted = items.filter(item => item.text.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfText[][] = [];
  for (const item of sorted) {
    const line = lines.at(-1);
    const tolerance = Math.max(1, Math.min(item.height, line?.[0].height ?? item.height) * 0.3);
    if (line && Math.abs(line[0].y - item.y) <= tolerance) line.push(item);
    else lines.push([item]);
  }
  return lines.map(line => {
    const phrases: Phrase[] = [];
    for (const item of line.sort((a, b) => a.x - b.x)) {
      const last = phrases.at(-1);
      const gap = last ? item.x - last.end : Infinity;
      const size = item.height || 8;
      const text = item.text.replace(/\s+/g, ' ').trim();
      if (last && gap < size * 0.6) {
        last.text += (gap > size * 0.1 || /\s$/.test(item.text) ? ' ' : '') + text;
        last.end = Math.max(last.end, item.x + item.width);
      } else {
        phrases.push({ text, start: item.x, end: item.x + item.width, y: item.y });
      }
    }
    for (const phrase of phrases) phrase.text = phrase.text.replace(/\s+/g, ' ').trim();
    return phrases;
  });
}

function headerColumns(line: Phrase[]): Column[] | null {
  const names = line.map(p => normalize(p.text));
  if (!names.some(name => name.startsWith('fecha')) || !names.some(name => HEADER_AMOUNT.test(name))) return null;
  // A header names columns; a line with a date in it is a movement or a summary.
  if (line.some(p => /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(p.text))) return null;
  return line.map(p => ({ center: (p.start + p.end) / 2, label: p.text }));
}

function columnOf(phrase: Phrase, columns: Column[]): number {
  const center = (phrase.start + phrase.end) / 2;
  let best = 0;
  columns.forEach((column, index) => {
    if (Math.abs(column.center - center) < Math.abs(columns[best].center - center)) best = index;
  });
  return best;
}

/** Text runs of every page, read with pdf.js, which loads only when a PDF is picked. */
export async function readPdfText(bytes: Uint8Array): Promise<PdfText[][]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', document.baseURI).href;
  const task = pdfjs.getDocument({ data: bytes });
  const document_ = await task.promise;
  const pages: PdfText[][] = [];
  try {
    for (let number = 1; number <= document_.numPages; number++) {
      const page = await document_.getPage(number);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .filter(item => 'str' in item)
          .map(item => ({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height || Math.abs(item.transform[3]),
          }))
      );
    }
  } finally {
    await task.destroy();
  }
  return pages;
}
