import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createClient } from '@lighter/db';
import { runMigrations, migrationsDir, createProject, mintToken } from '@lighter/db';
import { registerPreviewOriginRoutes } from './previewOriginRoutes.js';

const SECRET = 'test-secret';

function setup() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite, migrationsDir);
  const app = new Hono();
  registerPreviewOriginRoutes(app, db, { db, tokenSecret: SECRET });
  return { app, db };
}

describe('preview-origin routes (#166)', () => {
  let app: Hono;
  let acmeToken: string;
  let otherToken: string;

  beforeEach(async () => {
    const s = setup();
    app = s.app;
    await createProject(s.db, { id: 'acme', name: 'Acme' });
    await createProject(s.db, { id: 'other', name: 'Other' });
    acmeToken = (await mintToken(s.db, 'acme', { label: 'cli', secret: SECRET })).token;
    otherToken = (await mintToken(s.db, 'other', { label: 'cli', secret: SECRET })).token;
  });

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  it('rejects an unauthenticated caller', async () => {
    expect((await app.request('/preview-origins')).status).toBe(401);
  });

  it('works on the machine lane, so a token-only studio is not broken', async () => {
    const res = await app.request('/preview-origins', { headers: auth(acmeToken) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('adds and lists an origin', async () => {
    const post = await app.request('/preview-origins', {
      method: 'POST',
      headers: { ...auth(acmeToken), 'content-type': 'application/json' },
      body: JSON.stringify({ origin: 'https://shop.example.com', label: 'Staging' }),
    });
    expect(post.status).toBe(201);
    const list = await (await app.request('/preview-origins', { headers: auth(acmeToken) })).json();
    expect(list).toEqual([
      expect.objectContaining({ origin: 'https://shop.example.com', label: 'Staging' }),
    ]);
  });

  it('rejects a non-origin with a message rather than storing it', async () => {
    const res = await app.request('/preview-origins', {
      method: 'POST',
      headers: { ...auth(acmeToken), 'content-type': 'application/json' },
      body: JSON.stringify({ origin: 'https://evil.com/login' }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toMatch(/bare origin/i);
  });

  it('scopes to the credential, not the path — one project cannot read another', async () => {
    await app.request('/preview-origins', {
      method: 'POST',
      headers: { ...auth(acmeToken), 'content-type': 'application/json' },
      body: JSON.stringify({ origin: 'https://shop.example.com' }),
    });
    const otherList = await (
      await app.request('/preview-origins', { headers: auth(otherToken) })
    ).json();
    expect(otherList).toEqual([]);
  });

  it('removes, and 404s on an origin that is not there', async () => {
    await app.request('/preview-origins', {
      method: 'POST',
      headers: { ...auth(acmeToken), 'content-type': 'application/json' },
      body: JSON.stringify({ origin: 'https://shop.example.com' }),
    });
    const del = await app.request('/preview-origins?origin=https%3A%2F%2Fshop.example.com', {
      method: 'DELETE',
      headers: auth(acmeToken),
    });
    expect(del.status).toBe(200);
    const again = await app.request('/preview-origins?origin=https%3A%2F%2Fshop.example.com', {
      method: 'DELETE',
      headers: auth(acmeToken),
    });
    expect(again.status).toBe(404);
  });
});
