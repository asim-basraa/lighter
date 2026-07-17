import { describe, it, expect } from 'vitest';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import { createComment, listComments } from './comments.js';

function freshDb() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite, migrationsDir);
  return db;
}

describe('comments', () => {
  it('creates a comment anchored to a version + element and reads it back', async () => {
    const db = freshDb();
    const created = await createComment(db, {
      screenId: 'checkout',
      version: 2,
      elementId: 'el-3',
      body: 'Make this button primary',
      author: 'Dana',
    });
    expect(created.id).toBeTypeOf('number');
    expect(created).toMatchObject({
      screenId: 'checkout',
      version: 2,
      elementId: 'el-3',
      body: 'Make this button primary',
      author: 'Dana',
    });
    expect(created.createdAt).toEqual(expect.any(String));

    const list = await listComments(db, 'checkout', 2);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ elementId: 'el-3', body: 'Make this button primary' });
  });

  it('defaults a missing author to null', async () => {
    const db = freshDb();
    const c = await createComment(db, {
      screenId: 'home',
      version: 1,
      elementId: 'el-0',
      body: 'Anonymous note',
    });
    expect(c.author).toBeNull();
  });

  it('lists a version comments in creation order, scoped to that version', async () => {
    const db = freshDb();
    await createComment(db, { screenId: 'home', version: 1, elementId: 'el-0', body: 'first' });
    await createComment(db, { screenId: 'home', version: 1, elementId: 'el-1', body: 'second' });
    // A different version of the same screen is a separate thread.
    await createComment(db, { screenId: 'home', version: 2, elementId: 'el-0', body: 'other ver' });
    // A different screen entirely.
    await createComment(db, {
      screenId: 'login',
      version: 1,
      elementId: 'el-0',
      body: 'other scr',
    });

    const v1 = await listComments(db, 'home', 1);
    expect(v1.map((c) => c.body)).toEqual(['first', 'second']);
  });

  it('returns an empty list for a version with no comments', async () => {
    const db = freshDb();
    expect(await listComments(db, 'home', 9)).toEqual([]);
  });
});
