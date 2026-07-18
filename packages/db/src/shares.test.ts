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
    const resolved = await resolveShare(db, share.token);
    expect(resolved).toMatchObject({ screenId: 'checkout', version: 3 });
    // The deploy timestamp travels with the resolved share (the banner's date).
    expect(resolved?.createdAt).toEqual(expect.any(String));
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
    expect(await resolveShare(db, v2.token)).toMatchObject({ screenId: 'home', version: 2 });
  });

  it('resolves an unknown token to null', async () => {
    const db = freshDb();
    expect(await resolveShare(db, 'deadbeef'.repeat(4))).toBeNull();
  });

  it('refuses a share whose expiry has passed (#34)', async () => {
    const db = freshDb();
    const past = await createShare(db, 'home', 1, '2000-01-01T00:00:00.000Z');
    const future = await createShare(db, 'home', 2, '2999-01-01T00:00:00.000Z');
    expect(await resolveShare(db, past.token)).toBeNull(); // expired → refused
    expect(await resolveShare(db, future.token)).toMatchObject({ screenId: 'home', version: 2 });
  });

  it('checks expiry against an injectable now', async () => {
    const db = freshDb();
    const s = await createShare(db, 'home', 1, '2026-07-01T00:00:00.000Z');
    expect(await resolveShare(db, s.token, new Date('2026-06-30T00:00:00Z'))).not.toBeNull();
    expect(await resolveShare(db, s.token, new Date('2026-07-02T00:00:00Z'))).toBeNull();
  });

  it('re-deploying updates the expiry while keeping the same token', async () => {
    const db = freshDb();
    const first = await createShare(db, 'home', 1, '2000-01-01T00:00:00.000Z'); // expired
    const again = await createShare(db, 'home', 1, '2999-01-01T00:00:00.000Z'); // extend
    expect(again.token).toBe(first.token);
    expect(await resolveShare(db, again.token)).toMatchObject({ version: 1 });
  });
});
