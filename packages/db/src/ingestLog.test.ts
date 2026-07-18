import { describe, it, expect } from 'vitest';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import { wasCommitIngested, recordIngestedCommit } from './ingestLog.js';

function freshDb() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite, migrationsDir);
  return db;
}

describe('ingest log (#36 idempotency)', () => {
  it('reports a commit as not ingested until recorded', async () => {
    const db = freshDb();
    expect(await wasCommitIngested(db, 'abc123')).toBe(false);
    await recordIngestedCommit(db, 'abc123');
    expect(await wasCommitIngested(db, 'abc123')).toBe(true);
  });

  it('recording the same commit twice is a no-op (no error)', async () => {
    const db = freshDb();
    await recordIngestedCommit(db, 'abc123');
    await recordIngestedCommit(db, 'abc123'); // idempotent
    expect(await wasCommitIngested(db, 'abc123')).toBe(true);
  });
});
