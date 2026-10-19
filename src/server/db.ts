import { neon } from '@neondatabase/serverless';

/**
 * The one Neon client every server module shares. Neon's HTTP driver opens no
 * long-lived connection, so a single module-level instance is safe on Workers.
 */
export const sql = neon(process.env.NEON_DATABASE_URL!);
