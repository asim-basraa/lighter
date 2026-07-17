import { describe, it, expect } from 'vitest';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import { getVersionState, setVersionState } from './versionStatus.js';

function freshDb() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite, migrationsDir);
  return db;
}

describe('versionStatus', () => {
  it('returns null before any state is set', async () => {
    const db = freshDb();
    expect(await getVersionState(db, 'home', 1)).toBeNull();
  });

  it('sets and reads a version state', async () => {
    const db = freshDb();
    await setVersionState(db, 'home', 1, 'shared');
    expect(await getVersionState(db, 'home', 1)).toBe('shared');
  });

  it('upserts: a second set on the same version replaces the state', async () => {
    const db = freshDb();
    await setVersionState(db, 'home', 1, 'shared');
    await setVersionState(db, 'home', 1, 'approved');
    expect(await getVersionState(db, 'home', 1)).toBe('approved');
  });

  it('keeps state per (screen, version)', async () => {
    const db = freshDb();
    await setVersionState(db, 'home', 1, 'shared');
    await setVersionState(db, 'home', 2, 'approved');
    await setVersionState(db, 'login', 1, 'changes-requested');
    expect(await getVersionState(db, 'home', 1)).toBe('shared');
    expect(await getVersionState(db, 'home', 2)).toBe('approved');
    expect(await getVersionState(db, 'login', 1)).toBe('changes-requested');
  });
});
