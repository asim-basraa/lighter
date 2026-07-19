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
  /** Owning project (#90); NULL is the legacy/global partition (on-disk ingest + single-tenant view). */
  projectId: text('project_id'),
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
  /** Optional expiry (ISO timestamp); NULL never expires. A past value is refused at resolve (#34). */
  expiresAt: text('expires_at'),
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

/** The configurable required sign-off parties per screen (#26); each has a role (customer/internal). */
export const signOffConfig = sqliteTable(
  'sign_off_config',
  {
    screenId: text('screen_id').notNull(),
    party: text('party').notNull(),
    role: text('role').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.screenId, t.party] }) }),
);

/** Which party has signed off a specific version (#26). A full set of these gates 'approved'. */
export const signOffs = sqliteTable(
  'sign_offs',
  {
    screenId: text('screen_id').notNull(),
    version: integer('version').notNull(),
    party: text('party').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({ pk: primaryKey({ columns: [t.screenId, t.version, t.party] }) }),
);

export type SignOffParty = typeof signOffConfig.$inferSelect;
export type SignOff = typeof signOffs.$inferSelect;

/** Ordered click-through flow links from a screen to other screens (#30). */
export const flowLinks = sqliteTable(
  'flow_links',
  {
    screenId: text('screen_id').notNull(),
    position: integer('position').notNull(),
    label: text('label').notNull(),
    targetScreenId: text('target_screen_id').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.screenId, t.position] }) }),
);

export type FlowLink = typeof flowLinks.$inferSelect;

/** Idempotency ledger for the design-system push webhook (#36): one row per processed commit sha. */
export const ingestedCommits = sqliteTable('ingested_commits', {
  commitSha: text('commit_sha').primaryKey(),
  ingestedAt: text('ingested_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

/**
 * A tenant in the multi-project cloud (#87). Every screen/inventory/review record will be scoped to
 * a project; this table plus `projectTokens` is the machine-auth (CLI / GitHub Action) foundation.
 */
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type ProjectRow = typeof projects.$inferSelect;

/**
 * A machine API token for a project (#87). Only the HMAC hash of the raw token is stored, so a DB
 * leak never yields a usable credential. The raw token is shown once at mint time. Human/studio
 * login is Supabase Auth (#91), not these tokens.
 */
export const projectTokens = sqliteTable('project_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  label: text('label'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  lastUsedAt: text('last_used_at'),
});

export type ProjectTokenRow = typeof projectTokens.$inferSelect;

/**
 * A local mirror of a Supabase-Auth user (#91). `id` is the Supabase user id (the JWT `sub`); the
 * studio never stores passwords — Supabase owns the credential. We keep just enough (id + email) to
 * attach a human to project memberships.
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type UserRow = typeof users.$inferSelect;

/**
 * Which users belong to which projects, and in what role (#91). Composite PK (project, user) so a
 * user appears once per project; role is 'owner' or 'member'. This is what makes a project a team
 * rather than a single token holder — a user can be a member of many projects.
 */
export const projectMembers = sqliteTable(
  'project_members',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({ pk: primaryKey({ columns: [t.projectId, t.userId] }) }),
);

export type ProjectMemberRow = typeof projectMembers.$inferSelect;

/**
 * A pending invitation to join a project (#91). An owner can invite by email before the invitee has
 * a Supabase account; on their first login the invite is materialized into `project_members`.
 */
export const projectInvites = sqliteTable(
  'project_invites',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    email: text('email').notNull(),
    role: text('role').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({ pk: primaryKey({ columns: [t.projectId, t.email] }) }),
);

export type ProjectInviteRow = typeof projectInvites.$inferSelect;
