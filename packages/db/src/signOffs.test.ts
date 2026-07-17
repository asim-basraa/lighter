import { describe, it, expect } from 'vitest';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import { getSignOffSet, setSignOffSet, recordSignOff, listSignOffs } from './signOffs.js';

function freshDb() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite, migrationsDir);
  return db;
}

describe('signOffs', () => {
  it('has an empty sign-off set until one is configured', async () => {
    const db = freshDb();
    expect(await getSignOffSet(db, 'home')).toEqual([]);
  });

  it('sets and reads the sign-off set', async () => {
    const db = freshDb();
    await setSignOffSet(db, 'home', [
      { party: 'acme', role: 'customer' },
      { party: 'lead', role: 'internal' },
    ]);
    expect(await getSignOffSet(db, 'home')).toEqual([
      { party: 'acme', role: 'customer' },
      { party: 'lead', role: 'internal' },
    ]);
  });

  it('replaces the whole set on re-configure', async () => {
    const db = freshDb();
    await setSignOffSet(db, 'home', [{ party: 'acme', role: 'customer' }]);
    await setSignOffSet(db, 'home', [{ party: 'lead', role: 'internal' }]);
    expect(await getSignOffSet(db, 'home')).toEqual([{ party: 'lead', role: 'internal' }]);
  });

  it('records sign-offs per version (idempotent) and lists them', async () => {
    const db = freshDb();
    await recordSignOff(db, 'home', 1, 'acme');
    await recordSignOff(db, 'home', 1, 'acme'); // idempotent
    await recordSignOff(db, 'home', 1, 'lead');
    await recordSignOff(db, 'home', 2, 'acme'); // separate version
    expect((await listSignOffs(db, 'home', 1)).sort()).toEqual(['acme', 'lead']);
    expect(await listSignOffs(db, 'home', 2)).toEqual(['acme']);
  });
});
