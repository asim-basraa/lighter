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
