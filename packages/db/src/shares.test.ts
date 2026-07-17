import { describe, it, expect } from 'vitest';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import { createShare, resolveShare } from './shares.js';

function freshDb() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite, migrationsDir);
  return db;
}

describe('shares', () => {
  it('mints an unguessable token and resolves it back to the version', async () => {
    const db = freshDb();
    const share = await createShare(db, 'checkout', 3);
    // 128 bits of entropy, hex-encoded — not derivable from the screen id or version.
    expect(share.token).toMatch(/^[0-9a-f]{32}$/);
    expect(share.screenId).toBe('checkout');
    expect(share.version).toBe(3);
    expect(await resolveShare(db, share.token)).toEqual({ screenId: 'checkout', version: 3 });
  });

  it('is idempotent per (screen, version): re-sharing returns the same stable token', async () => {
    const db = freshDb();
    const first = await createShare(db, 'home', 1);
    const second = await createShare(db, 'home', 1);
    expect(second.token).toBe(first.token);
  });

  it('mints distinct tokens for different versions of the same screen', async () => {
    const db = freshDb();
    const v1 = await createShare(db, 'home', 1);
    const v2 = await createShare(db, 'home', 2);
    expect(v1.token).not.toBe(v2.token);
    expect(await resolveShare(db, v2.token)).toEqual({ screenId: 'home', version: 2 });
  });

  it('resolves an unknown token to null', async () => {
    const db = freshDb();
    expect(await resolveShare(db, 'deadbeef'.repeat(4))).toBeNull();
  });
});
