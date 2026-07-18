import { describe, it, expect } from 'vitest';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import {
  createProject,
  getProject,
  listProjects,
  mintToken,
  resolveProjectByToken,
  revokeToken,
  hashToken,
} from './projects.js';

function freshDb() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite, migrationsDir);
  return db;
}

describe('projects + project tokens (#87)', () => {
  it('creates a project with a slugified id and reads it back', async () => {
    const db = freshDb();
    const p = await createProject(db, { name: 'Acme Co' });
    expect(p.id).toBe('acme-co');
    expect(await getProject(db, 'acme-co')).toMatchObject({ id: 'acme-co', name: 'Acme Co' });
    expect(await listProjects(db)).toHaveLength(1);
  });

  it('honors an explicit id', async () => {
    const db = freshDb();
    const p = await createProject(db, { name: 'Acme', id: 'acme-prod' });
    expect(p.id).toBe('acme-prod');
  });

  it('mints a raw token once, stores only its hash, and resolves the project', async () => {
    const db = freshDb();
    await createProject(db, { name: 'Acme', id: 'acme' });
    const minted = await mintToken(db, 'acme', { label: 'ci' });
    expect(minted.token).toMatch(/^lgt_/);
    expect(minted.projectId).toBe('acme');

    const resolved = await resolveProjectByToken(db, minted.token);
    expect(resolved?.id).toBe('acme');
  });

  it('rejects an unknown or empty token', async () => {
    const db = freshDb();
    await createProject(db, { name: 'Acme', id: 'acme' });
    await mintToken(db, 'acme');
    expect(await resolveProjectByToken(db, 'lgt_nope')).toBeNull();
    expect(await resolveProjectByToken(db, '')).toBeNull();
  });

  it('does not resolve when the signing secret differs (hash is secret-keyed)', async () => {
    const db = freshDb();
    await createProject(db, { name: 'Acme', id: 'acme' });
    const minted = await mintToken(db, 'acme', { secret: 'secret-a' });
    expect(await resolveProjectByToken(db, minted.token, 'secret-b')).toBeNull();
    expect(await resolveProjectByToken(db, minted.token, 'secret-a')).not.toBeNull();
  });

  it('revokes a token', async () => {
    const db = freshDb();
    await createProject(db, { name: 'Acme', id: 'acme' });
    const minted = await mintToken(db, 'acme');
    expect(await revokeToken(db, minted.token)).toBe(true);
    expect(await resolveProjectByToken(db, minted.token)).toBeNull();
    expect(await revokeToken(db, minted.token)).toBe(false);
  });

  it('never stores the raw token', async () => {
    const db = freshDb();
    await createProject(db, { name: 'Acme', id: 'acme' });
    const minted = await mintToken(db, 'acme');
    // The persisted value is the hash, not the raw token.
    const resolved = await resolveProjectByToken(db, minted.token);
    expect(resolved).not.toBeNull();
    expect(hashToken(minted.token)).not.toEqual(minted.token);
  });
});
