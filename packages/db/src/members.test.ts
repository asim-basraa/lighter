import { describe, it, expect } from 'vitest';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import { createProject } from './projects.js';
import {
  upsertUser,
  addMember,
  getMembership,
  listProjectsForUser,
  listMembers,
} from './members.js';

function freshDb() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite, migrationsDir);
  return db;
}

describe('users + project members (#91)', () => {
  it('upserts a user, keeping email current without duplicating the row', async () => {
    const db = freshDb();
    const first = await upsertUser(db, { id: 'sub-1', email: 'a@x.com' });
    expect(first).toMatchObject({ id: 'sub-1', email: 'a@x.com' });
    const second = await upsertUser(db, { id: 'sub-1', email: 'new@x.com' });
    expect(second.email).toBe('new@x.com');
  });

  it('adds a membership and reads it back with its role', async () => {
    const db = freshDb();
    await createProject(db, { name: 'Acme', id: 'acme' });
    await upsertUser(db, { id: 'sub-1', email: 'owner@x.com' });
    await addMember(db, 'acme', 'sub-1', 'owner');
    expect(await getMembership(db, 'acme', 'sub-1')).toEqual({
      projectId: 'acme',
      userId: 'sub-1',
      role: 'owner',
    });
    expect(await getMembership(db, 'acme', 'stranger')).toBeNull();
  });

  it('upserts a membership role rather than duplicating (composite PK)', async () => {
    const db = freshDb();
    await createProject(db, { name: 'Acme', id: 'acme' });
    await upsertUser(db, { id: 'sub-1' });
    await addMember(db, 'acme', 'sub-1', 'member');
    await addMember(db, 'acme', 'sub-1', 'owner');
    expect((await getMembership(db, 'acme', 'sub-1'))?.role).toBe('owner');
    expect(await listMembers(db, 'acme')).toHaveLength(1);
  });

  it('lists every project a user belongs to, with role', async () => {
    const db = freshDb();
    await createProject(db, { name: 'Acme', id: 'acme' });
    await createProject(db, { name: 'Beta', id: 'beta' });
    await upsertUser(db, { id: 'sub-1', email: 'u@x.com' });
    await addMember(db, 'acme', 'sub-1', 'owner');
    await addMember(db, 'beta', 'sub-1', 'member');
    const mine = await listProjectsForUser(db, 'sub-1');
    expect(mine).toHaveLength(2);
    expect(mine.find((p) => p.id === 'acme')?.role).toBe('owner');
    expect(mine.find((p) => p.id === 'beta')?.role).toBe('member');
  });

  it('lists members of a project with their emails', async () => {
    const db = freshDb();
    await createProject(db, { name: 'Acme', id: 'acme' });
    await upsertUser(db, { id: 'sub-1', email: 'owner@x.com' });
    await upsertUser(db, { id: 'sub-2', email: 'member@x.com' });
    await addMember(db, 'acme', 'sub-1', 'owner');
    await addMember(db, 'acme', 'sub-2', 'member');
    const members = await listMembers(db, 'acme');
    expect(members).toHaveLength(2);
    expect(members.find((m) => m.userId === 'sub-2')).toMatchObject({
      role: 'member',
      email: 'member@x.com',
    });
  });
});
