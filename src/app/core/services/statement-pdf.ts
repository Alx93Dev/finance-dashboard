import { normalize, parseStatementDate } from './statement-import';

/** A run of text on a PDF page; x and y are the bottom-left corner, y grows upwards. */
export interface PdfText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A small colored picture next to a movement, such as the arrow BCI draws
 * beside each card amount: green for money in (abono), orange for a charge.
 * x and y are the bottom-left corner, like text.
 */
export interface PdfMark {
  x: number;
  y: number;
  width: number;
  height: number;
  direction: 'in' | 'out';
}

interface Phrase {
  text: string;
  start: number;
  end: number;
  y: number;
  height: number;
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
 *
 * `marks` are the arrows of each page. A movement with a money-in arrow next
 * to it gets a minus sign on its amount, which on a card statement (where
 * positive amounts are charges) reads as a payment or refund.
 */
export function pdfTableRows(pages: PdfText[][], marks: PdfMark[][] = []): string[][] {
  const rows: string[][] = [];
  let columns: Column[] | null = null;
  let headerDone = false;

  pages.forEach((page, pageIndex) => {
    const lines = groupLines(page);
    let pageColumns: Column[] | null = null;
    let movements: { y: number; height: number; cells: string[][] }[] = [];
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
        movements.push({ y: line[0].y, height: line[0].height, cells });
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
      const pageMarks = marks[pageIndex] ?? [];
      for (const movement of movements) {
        const cells = movement.cells.map(parts => parts.join(' '));
        const mark = markOf(movement, pageMarks, spacing);
        if (mark?.direction === 'in') {
          const amount = amountColumnNear(mark, cells, columns);
          if (amount >= 0 && !cells[amount].trim().startsWith('-')) cells[amount] = `-${cells[amount].trim()}`;
        }
        rows.push(cells);
      }
    }
  });
  return rows;
}

/** The mark on the same line as a movement: its middle is closer to it than half the gap between movements. */
function markOf(movement: { y: number; height: number }, marks: PdfMark[], spacing: number): PdfMark | undefined {
  const middle = movement.y + movement.height / 2;
  const distance = (mark: PdfMark) => Math.abs(mark.y + mark.height / 2 - middle);
  return marks
    .filter(mark => distance(mark) < Math.max(spacing / 2, movement.height))
    .sort((a, b) => distance(a) - distance(b))[0];
}

/** The filled amount column closest to a mark, or -1. */
function amountColumnNear(mark: PdfMark, cells: string[], columns: Column[]): number {
  const middle = mark.x + mark.width / 2;
  let best = -1;
  columns.forEach((column, index) => {
    if (!HEADER_AMOUNT.test(normalize(column.label)) || !cells[index]?.trim()) return;
    if (best < 0 || Math.abs(column.center - middle) < Math.abs(columns[best].center - middle)) best = index;
  });
  return best;
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
        phrases.push({ text, start: item.x, end: item.x + item.width, y: item.y, height: item.height || 8 });
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

/** What a statement PDF holds: the text runs and the arrows of every page. */
export interface PdfContent {
  pages: PdfText[][];
  marks: PdfMark[][];
}

/**
 * Whether a small picture is a money-in (green) or charge (orange or red)
 * arrow, from the average color of its visible pixels. `data` holds RGB or
 * RGBA pixels, as pdf.js gives them.
 */
export function markDirection(data: Uint8Array | Uint8ClampedArray, channels: 3 | 4): PdfMark['direction'] | null {
  let red = 0, green = 0, blue = 0, count = 0;
  for (let i = 0; i + channels <= data.length; i += channels) {
    if (channels === 4 && data[i + 3] < 128) continue;
    // White or near-white background says nothing about the color.
    if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) continue;
    red += data[i];
    green += data[i + 1];
    blue += data[i + 2];
    count++;
  }
  if (count === 0) return null;
  [red, green, blue] = [red / count, green / count, blue / count];
  if (green > red + 30 && green > blue + 30) return 'in';
  if (red > green + 30 && red > blue + 30) return 'out';
  return null;
}

/** pdf.js image kinds with one byte per channel. */
const IMAGE_CHANNELS: Record<number, 3 | 4> = { 2: 3, 3: 4 };
/** Arrows are icons: a few points wide on the page. Logos and photos are larger. */
const MAX_MARK_SIZE = 20;

type Matrix = [number, number, number, number, number, number];

function multiply(m: Matrix, t: Matrix): Matrix {
  return [
    m[0] * t[0] + m[2] * t[1],
    m[1] * t[0] + m[3] * t[1],
    m[0] * t[2] + m[2] * t[3],
    m[1] * t[2] + m[3] * t[3],
    m[0] * t[4] + m[2] * t[5] + m[4],
    m[1] * t[4] + m[3] * t[5] + m[5],
  ];
}

interface PdfImage {
  width: number;
  height: number;
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
}

interface PdfObjects {
  get(id: string, callback: (value: unknown) => void): unknown;
}

/** An image of the page, once pdf.js has decoded it; null if it doesn't arrive soon. */
function imageOf(objects: PdfObjects, id: string): Promise<PdfImage | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), 2000);
    try {
      objects.get(id, value => {
        clearTimeout(timer);
        resolve(value as PdfImage | null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Small colored pictures drawn on a page, with where they are, from its drawing operations. */
export async function readPdfMarks(
  page: { getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>; objs: PdfObjects; commonObjs: PdfObjects },
  ops: Record<string, number>
): Promise<PdfMark[]> {
  const list = await page.getOperatorList();
  const marks: PdfMark[] = [];
  const addMark = async (id: string, matrix: Matrix) => {
    // An image fills the unit square, so the matrix gives its size and corner (when not rotated).
    const [a, b, c, d, x, y] = matrix;
    const width = Math.abs(a), height = Math.abs(d);
    if (b !== 0 || c !== 0 || width > MAX_MARK_SIZE || height > MAX_MARK_SIZE) return;
    const image = await imageOf(id.startsWith('g_') ? page.commonObjs : page.objs, id);
    const channels = IMAGE_CHANNELS[image?.kind ?? 0];
    if (!image?.data || !channels) return;
    const direction = markDirection(image.data, channels);
    if (direction) marks.push({ x: Math.min(x, x + a), y: Math.min(y, y + d), width, height, direction });
  };
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  for (let i = 0; i < list.fnArray.length; i++) {
    const fn = list.fnArray[i];
    const args = list.argsArray[i];
    if (fn === ops['save']) stack.push(ctm);
    else if (fn === ops['restore']) ctm = stack.pop() ?? ctm;
    else if (fn === ops['transform']) ctm = multiply(ctm, args as Matrix);
    else if (fn === ops['paintImageXObject']) await addMark(String(args[0]), ctm);
    else if (fn === ops['paintImageXObjectRepeat']) {
      // pdf.js joins the same image drawn many times in a row into one operation.
      const [id, scaleX, scaleY, positions] = args as [string, number, number, number[]];
      for (let p = 0; p + 1 < positions.length; p += 2) {
        await addMark(String(id), multiply(ctm, [scaleX, 0, 0, scaleY, positions[p], positions[p + 1]]));
      }
    }
  }
  return marks;
}

/** Text runs and arrows of every page, read with pdf.js, which loads only when a PDF is picked. */
export async function readPdfText(bytes: Uint8Array): Promise<PdfContent> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs/pdf.worker.min.mjs', document.baseURI).href;
  // Without offscreen canvas, images come as plain pixels whose color can be read.
  const task = pdfjs.getDocument({ data: bytes, isOffscreenCanvasSupported: false });
  const document_ = await task.promise;
  const pages: PdfText[][] = [];
  const marks: PdfMark[][] = [];
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
      // The arrows only help; a page whose drawing can't be read still has its text.
      marks.push(await readPdfMarks(page as never, pdfjs.OPS as unknown as Record<string, number>).catch(() => []));
    }
  } finally {
    await task.destroy();
  }
  return { pages, marks };
}
