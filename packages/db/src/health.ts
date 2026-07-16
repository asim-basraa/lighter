import type { Db } from './client.js';
import { healthChecks, type HealthCheck } from './schema.js';

/**
 * Tiny repository proving the ORM round-trips. These calls use the dialect-agnostic drizzle query
 * builder, so they are unchanged when the driver swaps from SQLite to Postgres.
 */
export function insertHealthCheck(db: Db, note: string): HealthCheck {
  return db.insert(healthChecks).values({ note }).returning().get();
}

export function listHealthChecks(db: Db): HealthCheck[] {
  return db.select().from(healthChecks).all();
}
