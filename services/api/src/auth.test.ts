import { describe, it, expect } from 'vitest';
import { createClient, runMigrations, createProject, mintToken } from '@lighter/db';
import { createApp } from './app.js';

function testApp(withAuth = true) {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  const app = createApp(withAuth ? { db, auth: { db } } : { db });
  return { app, db };
}

describe('project bearer auth (#87)', () => {
  it('GET /projects/me returns the authed project for a valid token', async () => {
    const { app, db } = testApp();
    await createProject(db, { name: 'Acme', id: 'acme' });
    const { token } = await mintToken(db, 'acme');

    const res = await app.request('/projects/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'acme', name: 'Acme' });
  });

  it('refuses a missing token with 401', async () => {
    const { app } = testApp();
    const res = await app.request('/projects/me');
    expect(res.status).toBe(401);
  });

  it('refuses an unknown token with 401', async () => {
    const { app, db } = testApp();
    await createProject(db, { name: 'Acme', id: 'acme' });
    const res = await app.request('/projects/me', {
      headers: { authorization: 'Bearer lgt_bogus' },
    });
    expect(res.status).toBe(401);
  });

  it('does not mount the auth surface when auth is not configured', async () => {
    const { app } = testApp(false);
    const res = await app.request('/projects/me', {
      headers: { authorization: 'Bearer whatever' },
    });
    expect(res.status).toBe(404);
  });
});
