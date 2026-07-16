import type Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory holding ordered `NNNN_name.sql` migration files. */
export const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/**
 * Apply pending `*.sql` migrations in lexicographic order, tracking applied files in a
 * `_migrations` ledger so re-running is safe even for non-idempotent DDL (ALTER, INSERT, backfill).
 * Raw SQL lives only in migration files (per the persistence decision); everything else goes
 * through the ORM. Each file + its ledger insert run in one transaction, so a failed migration
 * leaves neither partial schema nor a phantom ledger row. Returns the files applied this run.
 */
export function runMigrations(sqlite: Database.Database, dir: string = migrationsDir): string[] {
  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedRows = sqlite.prepare('SELECT name FROM _migrations').all() as { name: string }[];
  const applied = new Set(appliedRows.map((r) => r.name));
  const insert = sqlite.prepare('INSERT INTO _migrations (name) VALUES (?)');

  const newlyApplied: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const ddl = readFileSync(join(dir, file), 'utf8');
    const apply = sqlite.transaction(() => {
      sqlite.exec(ddl);
      insert.run(file);
    });
    try {
      apply();
    } catch (err) {
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
    newlyApplied.push(file);
  }

  return newlyApplied;
}
