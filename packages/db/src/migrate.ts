import type Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory holding ordered `NNNN_name.sql` migration files. */
export const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/**
 * Apply every `*.sql` migration in lexicographic order. Raw SQL lives only in migration files
 * (per the persistence decision); everything else goes through the ORM. Each file runs in a
 * transaction so a partial file cannot leave the schema half-applied.
 */
export function runMigrations(sqlite: Database.Database, dir: string = migrationsDir): string[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const ddl = readFileSync(join(dir, file), 'utf8');
    sqlite.exec('BEGIN');
    try {
      sqlite.exec(ddl);
      sqlite.exec('COMMIT');
    } catch (err) {
      sqlite.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }

  return files;
}
