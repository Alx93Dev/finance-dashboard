import { parseCsv } from './statement-import';
import { pdfTableRows, readPdfText } from './statement-pdf';

/**
 * Reads a bank statement file into rows of cell text, whatever its format:
 * CSV, Excel (.xlsx or the older .xls), an HTML table saved as .xls, which
 * some banks hand out, or a PDF statement that has text (not a scan). Excel is read here without a library: only the cell
 * values of the first sheet are needed.
 */
export async function readStatementFile(file: Blob): Promise<string[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return readXlsx(bytes);
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return readXls(bytes);
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return readPdf(bytes);
  const text = decodeText(bytes);
  if (/^\s*<(!doctype|html|table|\?xml)/i.test(text.replace(/^﻿/, ''))) return readHtmlTable(text);
  return parseCsv(text);
}

/** Bank exports are often Windows-1252 rather than UTF-8; accents would break otherwise. */
export function decodeText(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Error with a message meant for the person importing the file. */
export class StatementFileError extends Error {}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte);
}

// ---------------------------------------------------------------- cell text

/** Excel stores dates as days since 1899-12-30 (or 1904-01-01). */
function serialToDate(serial: number, date1904: boolean): string {
  const days = Math.floor(serial) + (date1904 ? 1462 : 0);
  const date = new Date(Date.UTC(1899, 11, 30) + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

/** Plain decimal text with at most two decimals, so "1.234" is never read as thousands. */
function numberText(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** Whether a number format code shows a date (has d, m or y outside quotes and brackets). */
export function isDateFormat(code: string): boolean {
  const bare = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
  return /[dy]/i.test(bare) || (/m/i.test(bare) && !/[hs]/i.test(bare));
}

/** Built-in Excel format ids that are dates. */
const DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/** Places cells in rows by their position and drops rows that are entirely empty. */
class Grid {
  private readonly rows = new Map<number, string[]>();

  set(row: number, col: number, value: string): void {
    const cells = this.rows.get(row) ?? [];
    cells[col] = value.trim();
    this.rows.set(row, cells);
  }

  toRows(): string[][] {
    return [...this.rows.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, cells]) => Array.from(cells, cell => cell ?? ''))
      .filter(cells => cells.some(cell => cell !== ''));
  }
}

// ---------------------------------------------------------------------- xlsx

interface ZipEntry {
  method: number;
  compressedSize: number;
  offset: number;
}

function readZipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new StatementFileError('El archivo Excel está dañado.');
  const count = view.getUint16(end + 10, true);
  let pos = view.getUint32(end + 16, true);
  const entries = new Map<string, ZipEntry>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count && view.getUint32(pos, true) === 0x02014b50; i++) {
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const local = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
    const offset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    entries.set(name.replace(/^\//, ''), { method, compressedSize, offset });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function unzip(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const data = bytes.slice(entry.offset, entry.offset + entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) throw new StatementFileError('El archivo Excel usa una compresión que no podemos leer.');
  const stream = new Response(data).body!.pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function elements(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', name));
}

/** Text of an <si> or <is> string item, without phonetic hints. */
function stringItemText(item: Element): string {
  return elements(item, 't')
    .filter(t => (t.parentElement?.localName ?? '') !== 'rPh')
    .map(t => t.textContent ?? '')
    .join('');
}

/** Column index from a cell reference such as "AB12". */
function columnIndex(ref: string): number {
  let index = 0;
  for (const char of ref.toUpperCase()) {
    if (char < 'A' || char > 'Z') break;
    index = index * 26 + char.charCodeAt(0) - 64;
  }
  return index - 1;
}

export async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const entries = readZipEntries(bytes);
  const read = async (name: string) => {
    const entry = entries.get(name);
    return entry ? parseXml(await unzip(bytes, entry)) : null;
  };

  const workbook = await read('xl/workbook.xml');
  if (!workbook) throw new StatementFileError('El archivo no es un Excel válido.');
  const date1904 = ['1', 'true'].includes(elements(workbook, 'workbookPr')[0]?.getAttribute('date1904') ?? '');

  // First sheet, through the workbook relationships.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const firstSheet = elements(workbook, 'sheet')[0];
  const relId = firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    ?? firstSheet?.getAttribute('r:id');
  const rels = await read('xl/_rels/workbook.xml.rels');
  const target = rels && elements(rels, 'Relationship').find(rel => rel.getAttribute('Id') === relId)?.getAttribute('Target');
  if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`.replace(/\/\.\//g, '/');

  const shared = await read('xl/sharedStrings.xml');
  const strings = shared ? elements(shared, 'si').map(stringItemText) : [];

  const styles = await read('xl/styles.xml');
  const dateStyles = new Set<number>();
  if (styles) {
    const custom = new Map(elements(styles, 'numFmt').map(f => [Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') ?? '']));
    const cellXfs = elements(styles, 'cellXfs')[0];
    const xfs = cellXfs ? Array.from(cellXfs.children).filter(el => el.localName === 'xf') : [];
    xfs.forEach((xf, index) => {
      const id = Number(xf.getAttribute('numFmtId') ?? 0);
      if (DATE_FORMAT_IDS.has(id) || isDateFormat(custom.get(id) ?? '')) dateStyles.add(index);
    });
  }

  const sheet = await read(sheetPath);
  if (!sheet) throw new StatementFileError('No encontramos la hoja con los movimientos.');
  const grid = new Grid();
  elements(sheet, 'row').forEach((rowElement, rowPosition) => {
    const rowNumber = Number(rowElement.getAttribute('r') ?? rowPosition + 1);
    let nextColumn = 0;
    for (const cell of Array.from(rowElement.children).filter(el => el.localName === 'c')) {
      const ref = cell.getAttribute('r');
      const col = ref ? columnIndex(ref) : nextColumn;
      nextColumn = col + 1;
      const type = cell.getAttribute('t') ?? 'n';
      const raw = elements(cell, 'v')[0]?.textContent ?? '';
      let value: string;
      if (type === 's') value = strings[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = elements(cell, 'is').map(stringItemText).join('');
      else if (type === 'n' && raw !== '') {
        const number = Number(raw);
        value = dateStyles.has(Number(cell.getAttribute('s') ?? 0)) ? serialToDate(number, date1904) : numberText(number);
      } else if (type === 'e') value = '';
      else value = raw;
      grid.set(rowNumber, col, value);
    }
  });
  return grid.toRows();
}

// ----------------------------------------------------------------------- xls

const END_OF_CHAIN = 0xfffffffe;

/** Reads the "Workbook" stream out of an OLE compound file. */
function readCompoundStream(bytes: Uint8Array, names: string[]): Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sectorSize = 1 << view.getUint16(0x1e, true);
  const miniSectorSize = 1 << view.getUint16(0x20, true);
  const fatSectorCount = view.getUint32(0x2c, true);
  const firstDirectory = view.getUint32(0x30, true);
  const miniCutoff = view.getUint32(0x38, true);
  const firstMiniFat = view.getUint32(0x3c, true);
  let difatSector = view.getUint32(0x44, true);
  const sectorOffset = (sector: number) => (sector + 1) * sectorSize;

  // Sectors that hold the allocation table: 109 in the header, the rest chained.
  const fatSectors: number[] = [];
  for (let i = 0; i < 109 && fatSectors.length < fatSectorCount; i++) fatSectors.push(view.getUint32(0x4c + i * 4, true));
  const perSector = sectorSize / 4;
  let guard = 0;
  while (fatSectors.length < fatSectorCount && difatSector < END_OF_CHAIN && guard++ < 10_000) {
    const base = sectorOffset(difatSector);
    for (let i = 0; i < perSector - 1 && fatSectors.length < fatSectorCount; i++) fatSectors.push(view.getUint32(base + i * 4, true));
    difatSector = view.getUint32(base + (perSector - 1) * 4, true);
  }
  const fat: number[] = [];
  for (const sector of fatSectors) {
    const base = sectorOffset(sector);
    for (let i = 0; i < perSector && base + i * 4 + 4 <= bytes.length; i++) fat.push(view.getUint32(base + i * 4, true));
  }

  const chain = (start: number, table: number[]) => {
    const sectors: number[] = [];
    for (let sector = start; sector < END_OF_CHAIN && sectors.length <= table.length; sector = table[sector] ?? END_OF_CHAIN) {
      sectors.push(sector);
    }
    return sectors;
  };
  const readChain = (start: number) => {
    const sectors = chain(start, fat);
    const out = new Uint8Array(sectors.length * sectorSize);
    sectors.forEach((sector, i) => out.set(bytes.subarray(sectorOffset(sector), sectorOffset(sector) + sectorSize), i * sectorSize));
    return out;
  };

  const directory = readChain(firstDirectory);
  const dirView = new DataView(directory.buffer);
  interface DirEntry { name: string; type: number; start: number; size: number }
  const entries: DirEntry[] = [];
  for (let pos = 0; pos + 128 <= directory.length; pos += 128) {
    const nameLength = dirView.getUint16(pos + 0x40, true);
    const name = new TextDecoder('utf-16le').decode(directory.subarray(pos, pos + Math.max(0, nameLength - 2)));
    entries.push({ name, type: directory[pos + 0x42], start: dirView.getUint32(pos + 0x74, true), size: dirView.getUint32(pos + 0x78, true) });
  }
  const root = entries.find(entry => entry.type === 5);
  const stream = entries.find(entry => entry.type === 2 && names.includes(entry.name));
  if (!stream) return null;

  if (stream.size >= miniCutoff || !root) return readChain(stream.start).subarray(0, stream.size);

  // Small streams live in the mini stream, with their own allocation table.
  const miniStream = readChain(root.start);
  const miniFatBytes = firstMiniFat < END_OF_CHAIN ? readChain(firstMiniFat) : new Uint8Array();
  const miniFatView = new DataView(miniFatBytes.buffer);
  const miniFat = Array.from({ length: miniFatBytes.length / 4 }, (_, i) => miniFatView.getUint32(i * 4, true));
  const sectors = chain(stream.start, miniFat);
  const out = new Uint8Array(sectors.length * miniSectorSize);
  sectors.forEach((sector, i) => out.set(miniStream.subarray(sector * miniSectorSize, (sector + 1) * miniSectorSize), i * miniSectorSize));
  return out.subarray(0, stream.size);
}

/** Reads a BIFF8 unicode string that may continue into later CONTINUE records. */
class RecordReader {
  private segment = 0;
  private pos = 0;

  constructor(private readonly segments: Uint8Array[]) {}

  private get current(): Uint8Array {
    return this.segments[this.segment] ?? new Uint8Array();
  }

  private ensure(): void {
    while (this.pos >= this.current.length && this.segment < this.segments.length - 1) {
      this.segment++;
      this.pos = 0;
    }
  }

  get done(): boolean {
    return this.segment >= this.segments.length - 1 && this.pos >= this.current.length;
  }

  u8(): number {
    this.ensure();
    return this.current[this.pos++] ?? 0;
  }

  u16(): number {
    return this.u8() | (this.u8() << 8);
  }

  u32(): number {
    return (this.u16() | (this.u16() << 16)) >>> 0;
  }

  skip(count: number): void {
    for (let i = 0; i < count; i++) this.u8();
  }

  /** A string whose characters may be split across records; each new record repeats the flags byte. */
  string(): string {
    const length = this.u16();
    let flags = this.u8();
    const runs = flags & 0x08 ? this.u16() : 0;
    const extra = flags & 0x04 ? this.u32() : 0;
    let text = '';
    for (let i = 0; i < length; i++) {
      if (this.pos >= this.current.length && this.segment < this.segments.length - 1) {
        this.segment++;
        this.pos = 0;
        flags = this.u8();
      }
      text += String.fromCharCode(flags & 0x01 ? this.u16() : this.u8());
    }
    this.skip(runs * 4 + extra);
    return text;
  }
}

function decodeRk(rk: number): number {
  let value: number;
  if (rk & 0x02) {
    value = rk >> 2;
  } else {
    const buffer = new DataView(new ArrayBuffer(8));
    buffer.setUint32(4, rk & 0xfffffffc, true);
    value = buffer.getFloat64(0, true);
  }
  return rk & 0x01 ? value / 100 : value;
}

export function readXls(bytes: Uint8Array): string[][] {
  const stream = readCompoundStream(bytes, ['Workbook', 'Book']);
  if (!stream) throw new StatementFileError('El archivo no es un Excel válido.');
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);

  const records: { type: number; data: Uint8Array }[] = [];
  for (let pos = 0; pos + 4 <= stream.length;) {
    const type = view.getUint16(pos, true);
    const length = view.getUint16(pos + 2, true);
    records.push({ type, data: stream.subarray(pos + 4, pos + 4 + length) });
    pos += 4 + length;
  }

  const strings: string[] = [];
  const formats = new Map<number, string>();
  const xfFormats: number[] = [];
  let date1904 = false;
  let inSheet = false;
  const grid = new Grid();

  const dataView = (data: Uint8Array) => new DataView(data.buffer, data.byteOffset, data.byteLength);
  const numberCell = (row: number, col: number, xf: number, value: number) => {
    const format = xfFormats[xf] ?? 0;
    const isDate = DATE_FORMAT_IDS.has(format) || isDateFormat(formats.get(format) ?? '');
    grid.set(row, col, isDate ? serialToDate(value, date1904) : numberText(value));
  };

  for (let i = 0; i < records.length; i++) {
    const { type, data } = records[i];
    const d = dataView(data);
    switch (type) {
      case 0x0809: // BOF: 0x10 starts a worksheet
        if (d.getUint16(2, true) === 0x0010) inSheet = true;
        break;
      case 0x000a: // EOF: the first worksheet is enough
        if (inSheet) return grid.toRows();
        break;
      case 0x002f:
        throw new StatementFileError('El Excel está protegido con contraseña. Guárdalo sin contraseña e intenta de nuevo.');
      case 0x0022:
        date1904 = d.getUint16(0, true) === 1;
        break;
      case 0x041e: { // FORMAT
        const reader = new RecordReader([data.subarray(2)]);
        formats.set(d.getUint16(0, true), reader.string());
        break;
      }
      case 0x00e0: // XF
        xfFormats.push(d.getUint16(2, true));
        break;
      case 0x00fc: { // SST, continued in CONTINUE records
        const segments = [data.subarray(8)];
        while (records[i + 1]?.type === 0x003c) segments.push(records[++i].data);
        const reader = new RecordReader(segments);
        const unique = d.getUint32(4, true);
        for (let n = 0; n < unique && !reader.done; n++) strings.push(reader.string());
        break;
      }
      default:
        if (!inSheet) break;
        if (type === 0x00fd) { // LABELSST
          grid.set(d.getUint16(0, true), d.getUint16(2, true), strings[d.getUint32(6, true)] ?? '');
        } else if (type === 0x0204) { // LABEL
          grid.set(d.getUint16(0, true), d.getUint16(2, true), new RecordReader([data.subarray(6)]).string());
        } else if (type === 0x0203) { // NUMBER
          numberCell(d.getUint16(0, true), d.getUint16(2, true), d.getUint16(4, true), d.getFloat64(6, true));
        } else if (type === 0x027e) { // RK
          numberCell(d.getUint16(0, true), d.getUint16(2, true), d.getUint16(4, true), decodeRk(d.getUint32(6, true)));
        } else if (type === 0x00bd) { // MULRK
          const row = d.getUint16(0, true);
          const first = d.getUint16(2, true);
          const count = (data.length - 6) / 6;
          for (let n = 0; n < count; n++) {
            numberCell(row, first + n, d.getUint16(4 + n * 6, true), decodeRk(d.getUint32(6 + n * 6, true)));
          }
        } else if (type === 0x0006) { // FORMULA: keep its cached result
          const row = d.getUint16(0, true);
          const col = d.getUint16(2, true);
          if (d.getUint16(12, true) !== 0xffff) {
            numberCell(row, col, d.getUint16(4, true), d.getFloat64(6, true));
          } else if (data[6] === 0 && records[i + 1]?.type === 0x0207) {
            grid.set(row, col, new RecordReader([records[++i].data]).string());
          }
        }
    }
  }
  return grid.toRows();
}

// ----------------------------------------------------------------------- pdf

async function readPdf(bytes: Uint8Array): Promise<string[][]> {
  let pages;
  try {
    pages = await readPdfText(bytes);
  } catch (error) {
    if ((error as Error)?.name === 'PasswordException') {
      throw new StatementFileError('El PDF está protegido con contraseña. Descárgalo sin contraseña e intenta de nuevo.');
    }
    throw new StatementFileError('No pudimos abrir el PDF.');
  }
  if (pages.every(page => page.length === 0)) {
    throw new StatementFileError('El PDF no tiene texto (parece una imagen escaneada). Prueba con la cartola en Excel o CSV.');
  }
  return pdfTableRows(pages);
}

// ---------------------------------------------------------------------- html

export function readHtmlTable(text: string): string[][] {
  const document = new DOMParser().parseFromString(text, 'text/html');
  return Array.from(document.querySelectorAll('tr'))
    .map(row => Array.from(row.querySelectorAll('th, td'), cell => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()))
    .filter(cells => cells.some(cell => cell !== ''));
}
