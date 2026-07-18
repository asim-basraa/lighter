import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createClient,
  runMigrations,
  createProject,
  mintToken,
  saveInventory,
  type Db,
} from '@lighter/db';
import { createApp } from './app.js';
import { ProjectStores } from './projectStores.js';

const dirs: string[] = [];

async function scopedApp() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  const root = mkdtempSync(join(tmpdir(), 'lighter-scoped-'));
  dirs.push(root);
  const app = createApp({ db, storeProvider: new ProjectStores(root), auth: { db } });
  return { app, db };
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

async function project(db: Db, id: string) {
  await createProject(db, { name: id, id });
  const { token } = await mintToken(db, id);
  return { authorization: `Bearer ${token}` };
}

const json = (headers: Record<string, string>) => ({ ...headers, 'content-type': 'application/json' });

describe('project-scoped screens (#87)', () => {
  it('requires a valid token', async () => {
    const { app } = await scopedApp();
    expect((await app.request('/screens')).status).toBe(401);
    const res = await app.request('/screens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(401);
  });

  it('isolates screens per project — same id in two projects, no collision', async () => {
    const { app, db } = await scopedApp();
    const a = await project(db, 'acme');
    const b = await project(db, 'globex');

    const ra = await app.request('/screens', {
      method: 'POST',
      headers: json(a),
      body: JSON.stringify({ name: 'Checkout' }),
    });
    const rb = await app.request('/screens', {
      method: 'POST',
      headers: json(b),
      body: JSON.stringify({ name: 'Checkout' }),
    });
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201); // same id 'checkout' in a different project — no collision

    await app.request('/screens', {
      method: 'POST',
      headers: json(a),
      body: JSON.stringify({ name: 'Receipt' }),
    });

    const listA = (await (await app.request('/screens', { headers: a })).json()) as { id: string }[];
    const listB = (await (await app.request('/screens', { headers: b })).json()) as { id: string }[];
    expect(listA.map((s) => s.id).sort()).toEqual(['checkout', 'receipt']);
    expect(listB.map((s) => s.id)).toEqual(['checkout']); // globex never sees acme's screens
  });

  it("validates saved versions against the caller project's catalog", async () => {
    const { app, db } = await scopedApp();
    const a = await project(db, 'acme');
    await saveInventory(
      db,
      {
        components: [
          {
            name: 'PageShell',
            description: '',
            slots: ['default'],
            props: {
              type: 'object',
              properties: { title: { type: 'string' } },
              required: ['title'],
            },
          },
        ],
        tokens: [],
        health: [],
      },
      'acme',
    );
    await app.request('/screens', {
      method: 'POST',
      headers: json(a),
      body: JSON.stringify({ name: 'Home' }),
    });

    const good = await app.request('/screens/home/versions', {
      method: 'POST',
      headers: json(a),
      body: JSON.stringify({ spec: { root: { type: 'PageShell', props: { title: 'Hi' }, children: [] } } }),
    });
    expect(good.status).toBe(201);

    const bad = await app.request('/screens/home/versions', {
      method: 'POST',
      headers: json(a),
      body: JSON.stringify({ spec: { root: { type: 'NotInCatalog', props: {}, children: [] } } }),
    });
    expect(bad.status).toBe(400); // component absent from acme's catalog
  });
});
