// Applies db/*.sql to the database in NEON_DATABASE_URL. Each file must be one idempotent
// statement (Neon's HTTP driver runs a single statement per query).
// Usage: npm run db:migrate   (reads .env; override with NEON_DATABASE_URL=… npx tsx scripts/db-migrate.ts)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { neon } from '@neondatabase/serverless';

const url = process.env.NEON_DATABASE_URL;
if (!url) throw new Error('NEON_DATABASE_URL is not set');
const sql = neon(url);
const dir = join(__dirname, '..', 'db');

async function main(): Promise<void> {
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    await sql.query(readFileSync(join(dir, file), 'utf8'));
    console.log(`applied ${file}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
