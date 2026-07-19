import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type Dialect = 'sqlite' | 'postgres';

export interface DbConfig {
  dialect: Dialect;
  /** sqlite: a file path or ':memory:'. postgres: a connection string. */
  url: string;
}

export type Db = BetterSQLite3Database<typeof schema>;

export interface Client {
  sqlite: Database.Database;
  db: Db;
}

/**
 * Build the database client from an explicit config. SQLite is the v1 driver. Postgres is the
 * documented swap point: wire `drizzle-orm/node-postgres` here and change `DB_DIALECT` — no query
 * code changes elsewhere.
 */
export function createClient(config: DbConfig): Client {
  if (config.dialect === 'sqlite') {
    // Ensure the DB file's parent directory exists (e.g. a mounted volume path like `/data`) so
    // opening a fresh file never crashes with "directory does not exist" on first boot.
    if (!config.url.includes(':memory:')) {
      mkdirSync(dirname(config.url), { recursive: true });
    }
    const sqlite = new Database(config.url);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    return { sqlite, db };
  }

  throw new Error(
    `DB_DIALECT="${config.dialect}" is the documented Postgres swap point and is not wired yet. ` +
      `v1 ships SQLite; wire drizzle-orm/node-postgres here to enable Postgres. Query code is unchanged.`,
  );
}

/** Read config from the environment, defaulting to an in-memory SQLite database. */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): DbConfig {
  const raw = env.DB_DIALECT ?? 'sqlite';
  if (raw !== 'sqlite' && raw !== 'postgres') {
    throw new Error(`Unknown DB_DIALECT="${raw}". Expected "sqlite" or "postgres".`);
  }
  const url = env.DATABASE_URL ?? ':memory:';
  return { dialect: raw, url };
}
