import type { Db } from './client.js';
import { healthChecks, type HealthCheck } from './schema.js';

/**
 * Tiny repository proving the ORM round-trips. These calls use the portable async drizzle idiom
 * (await + array results) rather than the SQLite-only sync terminators (`.get()`/`.all()`), so the
 * query code is unchanged when the driver swaps from SQLite to Postgres — only the driver in
 * client.ts changes. This function is the reference pattern for every repository downstream.
 */
export async function insertHealthCheck(db: Db, note: string): Promise<HealthCheck> {
  const [row] = await db.insert(healthChecks).values({ note }).returning();
  if (!row) throw new Error('insertHealthCheck: insert returned no row');
  return row;
}

export async function listHealthChecks(db: Db): Promise<HealthCheck[]> {
  return db.select().from(healthChecks);
}
