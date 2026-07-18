import { describe, it, expect } from 'vitest';
import { createClient, runMigrations, createProject, mintToken } from '@lighter/db';
import { createApp } from './app.js';

function testApp() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  return { app: createApp({ db, auth: { db } }), db };
}

const catalog = {
  components: { Button: { description: 'A button.', props: { type: 'object' } } },
  previews: ['Button'],
};
const tokens = { 'color.primary': '#2563eb' };

async function authed(db: Parameters<typeof mintToken>[0]) {
  await createProject(db, { name: 'Acme', id: 'acme' });
  const { token } = await mintToken(db, 'acme');
  return token;
}

describe('POST /inventory — cloud push ingest (#90)', () => {
  it('ingests inline artifacts scoped to the authed project', async () => {
    const { app, db } = testApp();
    const token = await authed(db);

    const res = await app.request('/inventory', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ catalog, tokens }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { status: string; model: { components: { name: string }[] } };
    expect(body.status).toBe('ok');
    expect(body.model.components.map((c) => c.name)).toEqual(['Button']);
  });

  it('does not leak the pushed inventory into the global GET /inventory partition', async () => {
    const { app, db } = testApp();
    const token = await authed(db);
    await app.request('/inventory', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ catalog, tokens }),
    });
    // The public/global GET /inventory reads the null-project partition — still empty.
    expect((await app.request('/inventory')).status).toBe(404);
  });

  it('refuses an unauthenticated push with 401', async () => {
    const { app } = testApp();
    const res = await app.request('/inventory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ catalog, tokens }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects malformed artifacts with 400 and issues', async () => {
    const { app, db } = testApp();
    const token = await authed(db);
    const res = await app.request('/inventory', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ catalog: { components: 'nope' }, tokens }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()) as { issues?: unknown }).toHaveProperty('issues');
  });
});
