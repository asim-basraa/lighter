import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';

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

/**
 * A tokenized share link to one screen spec version (#21). The `token` is the only credential to
 * view a deployed mock — no account. One share per (screen_id, version) so re-sharing a version
 * yields a stable URL (enforced by a unique index on the pair; see migration 0002).
 */
export const shares = sqliteTable('shares', {
  token: text('token').primaryKey(),
  screenId: text('screen_id').notNull(),
  version: integer('version').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;

/**
 * A review comment anchored to one element of a screen spec version (#23). `elementId` is a
 * structural json-render id (`el-0`, `el-1`, …), stable for an immutable version — so a comment
 * survives layout changes rather than being pinned to pixels. `author` is optional (public reviewers
 * need no account). Threads/replies land in #24.
 */
export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  screenId: text('screen_id').notNull(),
  version: integer('version').notNull(),
  elementId: text('element_id').notNull(),
  body: text('body').notNull(),
  author: text('author'),
  /** Parent comment id for a reply; NULL for a top-level comment. Threads are one level deep (#24). */
  parentId: integer('parent_id'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

/**
 * Per-version approval state (#25). One row per (screen, version); a missing row means the default
 * 'draft'. Mutable review lifecycle, so it lives here rather than in the immutable spec files.
 */
export const versionStatus = sqliteTable(
  'version_status',
  {
    screenId: text('screen_id').notNull(),
    version: integer('version').notNull(),
    state: text('state').notNull(),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({ pk: primaryKey({ columns: [t.screenId, t.version] }) }),
);

export type VersionStatus = typeof versionStatus.$inferSelect;
