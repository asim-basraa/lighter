import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from './client.js';
import { runMigrations } from './migrate.js';
import { insertHealthCheck, listHealthChecks } from './health.js';

/**
 * The in-memory ledger test proves the applied-set logic within a single connection. This suite
 * proves the stronger, production-shaped guarantee: the `_migrations` ledger is persisted to disk
 * and honoured by a *fresh* connection — i.e. re-running `pnpm db:migrate` after a redeploy applies
 * nothing. This is the re-run-safety acceptance criterion as it actually happens (new process,
 * existing file), which a same-connection `:memory:` test cannot exercise.
 */
describe('file-backed migration ledger', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('persists the ledger across connections so a re-run applies nothing', async () => {
    dir = mkdtempSync(join(tmpdir(), 'lighter-db-'));
    const file = join(dir, 'ledger.sqlite');

    // First connection: fresh file, migration applies.
    const first = createClient({ dialect: 'sqlite', url: file });
    const firstApplied = runMigrations(first.sqlite);
    await insertHealthCheck(first.db, 'first connection');
    first.sqlite.close();

    expect(firstApplied).toEqual(['0000_init.sql']);
    expect(existsSync(file)).toBe(true);

    // Second connection against the same on-disk file: ledger already recorded, nothing re-applies,
    // and the row written by the first connection is still readable through the ORM.
    const second = createClient({ dialect: 'sqlite', url: file });
    const secondApplied = runMigrations(second.sqlite);
    const rows = await listHealthChecks(second.db);
    second.sqlite.close();

    expect(secondApplied).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.note).toBe('first connection');
    // Schema default is exercised end-to-end, not just declared.
    expect(rows[0]?.createdAt).toBeTruthy();
  });
});
