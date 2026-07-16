import { describe, it, expect } from 'vitest';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import { insertHealthCheck, listHealthChecks } from './health.js';

describe('db round-trip', () => {
  it('inserts and reads a row back through the Drizzle query API', () => {
    const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
    runMigrations(sqlite, migrationsDir);

    insertHealthCheck(db, 'scaffold ok');
    const rows = listHealthChecks(db);

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
});
