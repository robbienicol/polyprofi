import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit config. `npm run db:push` makes the database match
 * src/server/db/schema.ts; it shows the changes and asks before applying them.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  dbCredentials: { url: process.env.NEON_DATABASE_URL! },
});
