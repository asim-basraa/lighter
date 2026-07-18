import { describe, it, expect } from 'vitest';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import { saveInventory, latestInventory } from './inventory.js';
import { createProject } from './projects.js';

function freshDb() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite, migrationsDir);
  return db;
}

const modelA = { components: [{ name: 'A' }], tokens: [], health: [] };
const modelB = { components: [{ name: 'B' }], tokens: [], health: [] };
const modelGlobal = { components: [{ name: 'G' }], tokens: [], health: [] };

describe('inventory project scoping (#90)', () => {
  it('reads back the latest snapshot per project, isolated from other projects', async () => {
    const db = freshDb();
    await createProject(db, { name: 'A', id: 'a' });
    await createProject(db, { name: 'B', id: 'b' });

    await saveInventory(db, modelA, 'a');
    await saveInventory(db, modelB, 'b');

    expect(await latestInventory(db, 'a')).toEqual(modelA);
    expect(await latestInventory(db, 'b')).toEqual(modelB);
  });

  it('keeps the legacy/global partition (null project) separate from project snapshots', async () => {
    const db = freshDb();
    await createProject(db, { name: 'A', id: 'a' });

    await saveInventory(db, modelGlobal); // legacy global write (POST /ingest)
    await saveInventory(db, modelA, 'a');

    expect(await latestInventory(db)).toEqual(modelGlobal); // GET /inventory (global) unaffected
    expect(await latestInventory(db, 'a')).toEqual(modelA);
  });

  it('returns null for a project with no snapshot', async () => {
    const db = freshDb();
    await createProject(db, { name: 'A', id: 'a' });
    expect(await latestInventory(db, 'a')).toBeNull();
  });
});
