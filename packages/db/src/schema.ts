import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

/**
 * Schema is defined with drizzle's dialect-typed column helpers. The query API used everywhere
 * else (select/insert/update via the drizzle query builder) is identical for SQLite and Postgres;
 * swapping databases means swapping this column import + the driver in client.ts, not rewriting
 * queries. See README "Persistence".
 */
export const healthChecks = sqliteTable('health_checks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  note: text('note').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type HealthCheck = typeof healthChecks.$inferSelect;
export type NewHealthCheck = typeof healthChecks.$inferInsert;

/**
 * A persisted ingestion result. The inventory model is a projection of a design-system repo, stored
 * as a JSON snapshot so the dashboard/API can serve the latest without re-ingesting on every read.
 */
export const inventorySnapshots = sqliteTable('inventory_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** JSON-serialized InventoryModel (opaque to the DB layer). */
  model: text('model').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type InventorySnapshot = typeof inventorySnapshots.$inferSelect;
