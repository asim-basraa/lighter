import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import { insertHealthCheck, listHealthChecks } from './health.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('db round-trip', () => {
  it('inserts and reads a row back through the Drizzle query API', async () => {
    const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
    runMigrations(sqlite, migrationsDir);

    await insertHealthCheck(db, 'scaffold ok');
    const rows = await listHealthChecks(db);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.note).toBe('scaffold ok');
    expect(rows[0]?.id).toBeTypeOf('number');
  });

  it('creates the health_checks table from a migration', () => {
    const { sqlite } = createClient({ dialect: 'sqlite', url: ':memory:' });
    runMigrations(sqlite, migrationsDir);
    const table = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='health_checks'")
      .get();
    expect(table).toBeDefined();
  });

  it('rejects an unconfigured dialect at the documented swap point', () => {
    expect(() => createClient({ dialect: 'postgres', url: 'postgres://x' })).toThrow(/postgres/i);
  });

  it('creates a missing parent directory for the DB file (e.g. a fresh volume path)', () => {
    const base = mkdtempSync(join(tmpdir(), 'lighter-dbdir-'));
    dirs.push(base);
    const nested = join(base, 'data', 'nested'); // does not exist yet
    const { sqlite } = createClient({ dialect: 'sqlite', url: join(nested, 'lighter.db') });
    expect(existsSync(nested)).toBe(true);
    sqlite.close();
  });

  it('applies each migration once — the ledger makes re-runs a no-op', () => {
    const { sqlite } = createClient({ dialect: 'sqlite', url: ':memory:' });
    const first = runMigrations(sqlite, migrationsDir);
    const second = runMigrations(sqlite, migrationsDir);
    expect(first.length).toBeGreaterThan(0);
    expect(second).toHaveLength(0);
  });
});
