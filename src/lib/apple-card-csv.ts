/**
 * Parses the CSV Apple Card exports from Wallet (Card → ⋯ → Export Transactions).
 *
 * Apple's own header is
 *   Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD),Purchased By
 * but the column set has changed between iOS releases and a statement exported in
 * another region carries a different currency suffix, so nothing here is matched by
 * position or by an exact header string — every column is found by a normalized
 * prefix, and only a date, a name and an amount are actually required. A file that
 * still parses after Apple adds a column is worth more than one that validates the
 * shape Apple happened to ship this year.
 *
 * Deliberately not Plaid-shaped: this is the raw statement, and the clustering that
 * turns it into cuts lives in @/lib/spending-cut-detect.
 */

export interface StatementTransaction {
  /** Midnight local on the transaction date, as epoch ms. */
  date: number;
  /** The merchant as Apple names it, else the free-text description. */
  merchant: string;
  /** Apple's own category ("Restaurants", "Entertainment"), or '' when absent. */
  category: string;
  /** Dollars spent. Always positive — payments and refunds never reach this list. */
  amount: number;
}

export interface StatementParseResult {
  transactions: StatementTransaction[];
  /** Rows dropped for being unreadable — a count, not the rows: this is statement data. */
  skippedRows: number;
  /** Set when nothing usable came out, phrased for the import screen. */
  error: string | null;
}

/** A row Apple marks as one of these is money moving, not money spent. */
const NON_SPEND_TYPES = new Set(['payment', 'credit', 'refund', 'return', 'reversal']);

export function parseAppleCardCsv(text: string): StatementParseResult {
  const rows = splitRows(text);
  if (rows.length === 0) return { transactions: [], skippedRows: 0, error: 'That file is empty.' };

  const headerIndex = rows.findIndex((row) => columnMap(row) !== null);
  const columns = headerIndex >= 0 ? columnMap(rows[headerIndex]) : null;
  if (!columns) {
    return {
      transactions: [],
      skippedRows: 0,
      error: 'That doesn’t look like an Apple Card export — no date, merchant and amount columns.',
    };
  }

  const transactions: StatementTransaction[] = [];
  let skippedRows = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    // A trailing blank line is not a skipped row; a row of empty cells is the same thing.
    if (row.every((cell) => cell.trim() === '')) continue;

    const date = parseDate(cell(row, columns.date));
    const amount = parseAmount(cell(row, columns.amount));
    const merchant = cell(row, columns.merchant).trim() || cell(row, columns.description).trim();
    if (date === null || amount === null || !merchant) {
      skippedRows += 1;
      continue;
    }

    // Two ways a row is not spending: Apple labels it a payment, or the amount is a
    // credit. Both are dropped rather than negated — a refund is not a saving, and
    // letting one net against the month would understate a real recurring charge.
    const type = cell(row, columns.type).trim().toLowerCase();
    if (NON_SPEND_TYPES.has(type) || amount <= 0) continue;

    transactions.push({ date, merchant, category: cell(row, columns.category).trim(), amount });
  }

  if (transactions.length === 0) {
    return {
      transactions: [],
      skippedRows,
      error: 'No spending rows in that file — it may be a statement with payments only.',
    };
  }
  return { transactions, skippedRows, error: null };
}

interface ColumnMap {
  date: number;
  description: number;
  merchant: number;
  category: number;
  type: number;
  amount: number;
}

/**
 * Locates each column in a candidate header row, or null when the row isn't a header.
 * "Transaction Date" is preferred over "Clearing Date" (when the charge happened, not
 * when it settled), so the date match is ordered rather than first-wins.
 */
function columnMap(row: string[]): ColumnMap | null {
  const headers = row.map((value) => value.trim().toLowerCase());
  const find = (...prefixes: string[]): number => {
    for (const prefix of prefixes) {
      const index = headers.findIndex((header) => header.startsWith(prefix));
      if (index >= 0) return index;
    }
    return -1;
  };

  const date = find('transaction date', 'date', 'clearing date');
  const amount = find('amount');
  const merchant = find('merchant');
  const description = find('description');
  if (date < 0 || amount < 0 || (merchant < 0 && description < 0)) return null;

  return {
    date,
    amount,
    merchant,
    description,
    category: find('category'),
    type: find('type'),
  };
}

function cell(row: string[], index: number): string {
  return index >= 0 && index < row.length ? row[index] : '';
}

/**
 * Splits CSV into rows of cells, honouring quoted fields — a merchant name with a
 * comma in it ("SQ *BLUE BOTTLE, SF") is one cell, and `""` inside a quoted field is
 * a literal quote. Handles CRLF and a UTF-8 BOM, both of which Apple's export has.
 */
function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char !== '"') { value += char; continue; }
      if (source[index + 1] === '"') { value += '"'; index += 1; continue; }
      quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row.push(value); value = ''; continue; }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }
    value += char;
  }
  if (value !== '' || row.length > 0) { row.push(value); rows.push(row); }
  return rows;
}

/**
 * Apple writes MM/DD/YYYY in US exports and YYYY-MM-DD elsewhere. Both are built
 * from explicit parts rather than handed to `new Date(string)`, whose behaviour on
 * a bare date is timezone-dependent — a statement row would otherwise land in the
 * previous month for anyone west of UTC, which is exactly the boundary the monthly
 * clustering downstream keys on.
 */
function parseDate(value: string): number | null {
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return localMidnight(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    const year = Number(us[3]);
    return localMidnight(year < 100 ? 2000 + year : year, Number(us[1]), Number(us[2]));
  }
  return null;
}

function localMidnight(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  // Rejects the dates that silently roll over — 02/31 becomes March 3 otherwise.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime();
}

/** "$1,234.56", "(12.34)" and "-12.34" all mean what they look like. */
function parseAmount(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const negated = /^\(.*\)$/.test(text);
  const digits = text.replace(/[()]/g, '').replace(/[^0-9.\-]/g, '');
  if (digits === '' || digits === '-' || digits === '.') return null;
  const amount = Number(digits);
  if (!Number.isFinite(amount)) return null;
  return negated ? -amount : amount;
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const apple = [
    'Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD),Purchased By',
    '03/14/2026,03/15/2026,NETFLIX.COM,Netflix,Entertainment,Purchase,15.49,Robert Nicol',
    '03/02/2026,03/03/2026,"SQ *BLUE BOTTLE, SF",Blue Bottle Coffee,Restaurants,Purchase,"$6.75",Robert Nicol',
    '03/28/2026,03/28/2026,ACH DEPOSIT INTERNET TRANSFER,,Payment,Payment,-250.00,Robert Nicol',
    '03/20/2026,03/21/2026,AMAZON REFUND,Amazon,Shopping,Credit,-31.20,Robert Nicol',
  ].join('\r\n');

  const parsed = parseAppleCardCsv(apple);
  console.assert(parsed.error === null, 'a real Apple Card export parses');
  console.assert(parsed.transactions.length === 2, 'payments and credits are not spending');
  console.assert(parsed.transactions[0].merchant === 'Netflix', 'the merchant column beats the raw description');
  console.assert(parsed.transactions[1].amount === 6.75, '"$6.75" is 6.75');
  console.assert(
    parsed.transactions[1].merchant === 'Blue Bottle Coffee',
    'a quoted field containing a comma stays one cell, so the columns after it are not shifted',
  );
  console.assert(new Date(parsed.transactions[0].date).getDate() === 14, 'MM/DD/YYYY reads as local midnight on the 14th');

  const isoRows = parseAppleCardCsv('Date,Merchant,Amount\n2026-03-14,Netflix,15.49');
  console.assert(isoRows.transactions.length === 1 && isoRows.error === null, 'a shorter, ISO-dated header still parses');
  console.assert(new Date(isoRows.transactions[0].date).getMonth() === 2, 'an ISO date is not shifted by the timezone');

  const noMerchantColumn = parseAppleCardCsv('Transaction Date,Description,Amount\n03/14/2026,NETFLIX.COM,15.49');
  console.assert(noMerchantColumn.transactions[0]?.merchant === 'NETFLIX.COM', 'description stands in when there is no merchant column');

  const badRows = parseAppleCardCsv('Transaction Date,Merchant,Amount\n03/14/2026,Netflix,15.49\nnot-a-date,Netflix,15.49\n\n');
  console.assert(badRows.transactions.length === 1, 'an unreadable row is dropped, not fatal');
  console.assert(badRows.skippedRows === 1, 'a dropped row is counted; a blank trailing line is not one');

  console.assert(parseAppleCardCsv('').error !== null, 'an empty file is an error');
  console.assert(parseAppleCardCsv('hello world\nnothing here').error !== null, 'a file with no recognisable header is an error');
  console.assert(
    parseAppleCardCsv('Transaction Date,Merchant,Type,Amount\n03/14/2026,Chase,Payment,-250.00').error !== null,
    'a payments-only statement says so rather than importing nothing silently',
  );
  console.assert(parseAppleCardCsv('Transaction Date,Merchant,Amount\n02/31/2026,Netflix,15.49').skippedRows === 1, 'Feb 31 is not a date');
}
