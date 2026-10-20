/**
 * Detects the cuts in a real statement and writes them into `.env`, so the dev seed
 * button loads your own spending instead of making you import a CSV on every fresh
 * simulator.
 *
 *   bun run seed:statement                      # fixtures/apple-card-sample.csv
 *   bun run seed:statement path/to/export.csv
 *
 * `.env` is gitignored, which is the entire reason the cuts live there rather than in
 * a generated source file: a statement is somebody's real spending and must not reach
 * a tracked file. Only the detected cuts are written — a dozen merchant-and-amount
 * lines — never the transactions behind them.
 *
 * Restart Metro afterwards: EXPO_PUBLIC_ vars are inlined at bundle time.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { parseAppleCardCsv } from '@/lib/apple-card-csv';
import { detectSpendingCuts, statementMonths } from '@/lib/spending-cut-detect';

const VAR = 'EXPO_PUBLIC_DEV_SPENDING_CUTS';
const [path = 'fixtures/apple-card-sample.csv'] = process.argv.slice(2);

let text: string;
try {
  text = readFileSync(path, 'utf8');
} catch {
  console.error(`No statement at ${path}. Export one from Wallet and drop it in fixtures/.`);
  process.exit(1);
}

const parsed = parseAppleCardCsv(text);
if (parsed.error) {
  console.error(parsed.error);
  process.exit(1);
}

const months = statementMonths(parsed.transactions);
const cuts = detectSpendingCuts(parsed.transactions);
if (cuts.length === 0) {
  console.error(`No cuts detected in ${path} (${months} months covered). Nothing written.`);
  process.exit(1);
}

const payload = JSON.stringify({ cuts, monthsCovered: months, transactionCount: parsed.transactions.length });
// One line, single-quoted: the value is JSON and therefore full of double quotes, and
// this .env is read by shells as well as by Expo.
const line = `${VAR}='${payload.replace(/'/g, "'\\''")}'`;

const existing = readFileSync('.env', 'utf8');
const next = existing.includes(`${VAR}=`)
  ? existing.replace(new RegExp(`^${VAR}=.*$`, 'm'), line)
  : `${existing.replace(/\n*$/, '\n')}\n# Cuts from your own statement, for the dev seed button — regenerate with: bun run seed:statement\n${line}\n`;
writeFileSync('.env', next);

console.log(`Wrote ${cuts.length} cuts from ${path} — ${months} months, ${parsed.transactions.length} rows — into .env`);
for (const cut of cuts) {
  console.log(`  ${cut.kind.padEnd(13)} ${cut.merchant.padEnd(24)} $${cut.monthlyAmount.toFixed(2)}/mo`);
}
console.log('\nRestart Metro, then Settings → Seed demo data.');
