import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from '@/server/db/schema';

/**
 * The one database client every server module shares, typed from ./schema.
 *
 * Neon's HTTP driver opens no long-lived connection, which is what Cloudflare Workers
 * (EAS Hosting) needs. It can't run interactive transactions — use `db.batch([...])`
 * when several writes must land together.
 */
export const db = drizzle({ client: neon(process.env.NEON_DATABASE_URL!), schema });

export * from '@/server/db/schema';
