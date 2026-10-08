/**
 * Runs a real Apple Card CSV export through the whole import pipeline and prints what
 * the app would show — parse, detect, score — without touching a simulator.
 *
 *   bun run statement                      # fixtures/apple-card-sample.csv
 *   bun run statement path/to/export.csv
 *   bun run statement path/to/export.csv 2500 180   # target $, deadline days
 *
 * Statements under fixtures/ are gitignored: every rule in @/lib/spending-cut-detect
 * was written against a year of real spending, and none of that spending belongs in
 * the repository. Point this at your own export and read the output rather than
 * committing a file for someone else to run.
 */
import { readFileSync } from 'node:fs';

import { parseAppleCardCsv } from '@/lib/apple-card-csv';
import { detectSpendingCuts, statementMonths } from '@/lib/spending-cut-detect';
import { buildSpendingCutRoutes } from '@/lib/spending-cut-routes';

const [path = 'fixtures/apple-card-sample.csv', rawTarget = '1000', rawDeadline = '90'] = process.argv.slice(2);
const target = Number(rawTarget);
const deadlineDays = Number(rawDeadline);

let text: string;
try {
  text = readFileSync(path, 'utf8');
} catch {
  console.error(`No statement at ${path}. Export one from Wallet and drop it in fixtures/.`);
  process.exit(1);
}

const parsed = parseAppleCardCsv(text);
console.log(`${path}`);
console.log(`  ${parsed.transactions.length} spending rows over ${statementMonths(parsed.transactions)} months`
  + `, ${parsed.skippedRows} unreadable${parsed.error ? ` — ${parsed.error}` : ''}`);
if (parsed.error) process.exit(1);

const cuts = detectSpendingCuts(parsed.transactions);
console.log(`\ncuts (${cuts.length}):`);
for (const cut of cuts) {
  console.log(`  ${cut.kind.padEnd(13)} ${cut.merchant.padEnd(26)} $${cut.monthlyAmount.toFixed(2).padStart(8)}/mo`
    + `  seen ${String(cut.monthsObserved).padStart(2)}mo  swing ${cut.amountVariancePct?.toFixed(0).padStart(3) ?? '  —'}%`);
}

console.log(`\nroutes at a $${target} goal in ${deadlineDays} days:`);
for (const route of buildSpendingCutRoutes({ cuts, target, deadlineDays })) {
  console.log(`  $${String(route.expectedReturn).padStart(6)}  ${String(Math.round(route.probability)).padStart(2)}% reliable`
    + `  ${route.meetsTarget ? 'clears the goal alone' : 'partial'}\n      ${route.description}`);
}
