import { describe, it, expect } from 'vitest';
import { createClient, runMigrations, resolveProjectByToken } from '@lighter/db';
import { bootstrapProject } from './bootstrap.js';

function freshDb() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  return db;
}

describe('bootstrapProject (#87 first-deploy usability)', () => {
  it('creates the project + a usable token on first call', async () => {
    const db = freshDb();
    const res = await bootstrapProject(db, 'Acme Co');
    expect(res.created).toBe(true);
    expect(res.project.id).toBe('acme-co');
    expect(res.token).toMatch(/^lgt_/);
    // The minted token resolves back to the project.
    expect((await resolveProjectByToken(db, res.token!))?.id).toBe('acme-co');
  });

  it('is idempotent — a second call does not mint a new token', async () => {
    const db = freshDb();
    const first = await bootstrapProject(db, 'acme');
    const second = await bootstrapProject(db, 'acme');
    expect(second.created).toBe(false);
    expect(second.token).toBeUndefined();
    // The original token still works (was not rotated).
    expect((await resolveProjectByToken(db, first.token!))?.id).toBe('acme');
  });

  it('honors the token signing secret', async () => {
    const db = freshDb();
    const res = await bootstrapProject(db, 'acme', 'prod-secret');
    expect(await resolveProjectByToken(db, res.token!, 'prod-secret')).not.toBeNull();
    expect(await resolveProjectByToken(db, res.token!, 'other')).toBeNull();
  });
});
