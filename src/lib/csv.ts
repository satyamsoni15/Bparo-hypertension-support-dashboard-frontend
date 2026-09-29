// CSV export helpers shared by every table's "Export CSV" button.
//
// Pure and isomorphic (no DOM, no Node APIs): `toCsv` builds the file text on
// the client from rows + column definitions, and `collectAllPages` is used by
// server actions to walk a paginated endpoint with the table's filters.
//
// Output follows RFC 4180 (fields containing a comma, quote, CR or LF are
// wrapped in double quotes with inner quotes doubled; records end in CRLF),
// starts with a UTF-8 BOM so Excel opens accented/non-Latin text correctly,
// and neutralises spreadsheet formula injection: a text cell starting with
// = + - @ TAB or CR gets a leading single quote so Excel/Sheets/LibreOffice
// show it as text instead of evaluating it (OWASP "CSV Injection").

export type CsvValue = string | number | bigint | boolean | Date | null | undefined;

export type CsvColumn<T> = {
  header: string;
  value: (row: T, index: number) => CsvValue;
};

export type CsvRows<T> = {
  rows: T[];
  // Total rows the endpoint reported for these filters (may exceed rows.length
  // when the export hit the row cap).
  total?: number;
  truncated?: boolean;
};

export const CSV_BOM = "﻿";
export const CSV_EOL = "\r\n";
export const CSV_EXPORT_MAX_ROWS = 10_000;
export const CSV_EXPORT_PAGE_SIZE = 100;

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

function cellText(value: CsvValue): { text: string; isText: boolean } {
  if (value === null || value === undefined) return { text: "", isText: false };
  if (typeof value === "number") return { text: Number.isFinite(value) ? String(value) : "", isText: false };
  if (typeof value === "bigint") return { text: value.toString(), isText: false };
  if (typeof value === "boolean") return { text: value ? "Yes" : "No", isText: false };
  if (value instanceof Date) return { text: Number.isNaN(value.getTime()) ? "" : value.toISOString(), isText: false };
  // The tables' "no value" placeholder is an empty cell in the file.
  if (value === "—") return { text: "", isText: false };
  return { text: String(value), isText: true };
}

// One field, escaped. Numbers/booleans/dates are emitted as-is (a negative
// number is data, not a formula); only text is formula-guarded.
export function escapeCsvCell(value: CsvValue): string {
  const { text, isText } = cellText(value);
  const safe = isText && FORMULA_TRIGGER.test(text) ? `'${text}` : text;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(
  rows: readonly T[],
  columns: readonly CsvColumn<T>[],
  options: { bom?: boolean } = {}
): string {
  const lines = [columns.map((column) => escapeCsvCell(column.header)).join(",")];
  rows.forEach((row, index) => {
    lines.push(columns.map((column) => escapeCsvCell(column.value(row, index))).join(","));
  });
  return `${options.bom === false ? "" : CSV_BOM}${lines.join(CSV_EOL)}${CSV_EOL}`;
}

// "Lab test categories" -> "lab-test-categories-2026-09-16.csv" (local date).
export function csvFilename(name: string, date: Date = new Date()): string {
  const slug =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export";
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${slug}-${ymd}.csv`;
}

type PageResult<T> = { data: T[]; meta?: { total?: number; totalPages?: number } };
type Failure = { ok: false; error: string; status?: number };

// Walks page 1..N of a paginated endpoint (same filters on every call) until
// the last page, an empty page, or `maxRows`. Stops at the first failure and
// returns it, so the caller surfaces the backend's message.
export async function collectAllPages<T, E extends Failure>(
  fetchPage: (page: number, limit: number) => Promise<{ ok: true; data: PageResult<T> } | E>,
  options: { pageSize?: number; maxRows?: number } = {}
): Promise<{ ok: true; data: CsvRows<T> } | E> {
  const pageSize = Math.max(1, Math.trunc(options.pageSize ?? CSV_EXPORT_PAGE_SIZE));
  const maxRows = Math.max(1, Math.trunc(options.maxRows ?? CSV_EXPORT_MAX_ROWS));
  const rows: T[] = [];
  let total: number | undefined;

  for (let page = 1; ; page += 1) {
    const res = await fetchPage(page, pageSize);
    if (!res.ok) return res;
    const batch = Array.isArray(res.data.data) ? res.data.data : [];
    const reportedTotal = Number(res.data.meta?.total);
    if (Number.isFinite(reportedTotal)) total = reportedTotal;
    rows.push(...batch);

    if (rows.length >= maxRows) {
      const truncated = rows.length > maxRows || (total !== undefined ? total > maxRows : batch.length === pageSize);
      return { ok: true, data: { rows: rows.slice(0, maxRows), total, truncated } };
    }
    const totalPages = Number(res.data.meta?.totalPages);
    const lastPage = Number.isFinite(totalPages) && totalPages > 0 ? page >= totalPages : batch.length < pageSize;
    if (batch.length === 0 || lastPage) {
      return { ok: true, data: { rows, total: total ?? rows.length, truncated: false } };
    }
  }
}
