import { describe, it, expect } from 'vitest';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import { getFlow, setFlow } from './flow.js';
import { createShare, latestShareForScreen } from './shares.js';

function freshDb() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite, migrationsDir);
  return db;
}

describe('flow links', () => {
  it('has no flow until configured', async () => {
    const db = freshDb();
    expect(await getFlow(db, 'checkout')).toEqual([]);
  });

  it('sets and reads flow links in order', async () => {
    const db = freshDb();
    await setFlow(db, 'checkout', [
      { label: 'Continue', target: 'confirm' },
      { label: 'Back to cart', target: 'cart' },
    ]);
    expect(await getFlow(db, 'checkout')).toEqual([
      { label: 'Continue', target: 'confirm' },
      { label: 'Back to cart', target: 'cart' },
    ]);
  });

  it('replaces the whole flow on reconfigure', async () => {
    const db = freshDb();
    await setFlow(db, 'checkout', [{ label: 'Continue', target: 'confirm' }]);
    await setFlow(db, 'checkout', [{ label: 'Pay', target: 'pay' }]);
    expect(await getFlow(db, 'checkout')).toEqual([{ label: 'Pay', target: 'pay' }]);
  });
});

describe('latestShareForScreen', () => {
  it('returns null when the screen has no deployed version', async () => {
    const db = freshDb();
    expect(await latestShareForScreen(db, 'confirm')).toBeNull();
  });

  it('returns the token of the most-recently deployed version', async () => {
    const db = freshDb();
    await createShare(db, 'confirm', 1);
    const v3 = await createShare(db, 'confirm', 3);
    await createShare(db, 'confirm', 2);
    expect(await latestShareForScreen(db, 'confirm')).toBe(v3.token);
  });
});
