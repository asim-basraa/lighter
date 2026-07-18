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
import type { Hono } from 'hono';
import { createApp } from './app.js';
import { ProjectStores } from './projectStores.js';

const dirs: string[] = [];

async function scopedApp() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  const root = mkdtempSync(join(tmpdir(), 'lighter-review-'));
  dirs.push(root);
  return { app: createApp({ db, storeProvider: new ProjectStores(root), auth: { db } }), db };
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const catalog = [
  {
    name: 'PageShell',
    description: '',
    slots: ['default'],
    props: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
  },
  {
    name: 'Text',
    description: '',
    slots: [],
    props: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
  },
];

async function project(db: Db, id: string) {
  await createProject(db, { name: id, id });
  await saveInventory(db, { components: catalog, tokens: [], health: [] }, id);
  const { token } = await mintToken(db, id);
  return { authorization: `Bearer ${token}` };
}

const json = (h: Record<string, string>) => ({ ...h, 'content-type': 'application/json' });

/** Create screen "Home", save a v1 titled `title`, deploy it, and return the share token. */
async function deployHome(app: Hono, headers: Record<string, string>, title: string) {
  await app.request('/screens', {
    method: 'POST',
    headers: json(headers),
    body: JSON.stringify({ name: 'Home' }),
  });
  const spec = {
    root: {
      type: 'PageShell',
      props: { title },
      children: [{ type: 'Text', props: { content: title }, children: [] }],
    },
  };
  const v = await app.request('/screens/home/versions', {
    method: 'POST',
    headers: json(headers),
    body: JSON.stringify({ spec }),
  });
  expect(v.status).toBe(201);
  const share = await app.request('/screens/home/versions/1/share', {
    method: 'POST',
    headers: json(headers),
    body: '{}',
  });
  expect(share.status).toBe(201);
  return ((await share.json()) as { token: string }).token;
}

describe('project-scoped deploy + review (#87 scoping part 2)', () => {
  it("renders each project's own screen behind its share token — same screen id, isolated", async () => {
    const { app, db } = await scopedApp();
    const a = await project(db, 'acme');
    const b = await project(db, 'globex');
    const tokenA = await deployHome(app, a, 'Acme Home');
    const tokenB = await deployHome(app, b, 'Globex Home'); // same id 'home', different project

    const renderA = (await (await app.request(`/share/${tokenA}`)).json()) as {
      spec: { root: { props: { title: string } } };
    };
    const renderB = (await (await app.request(`/share/${tokenB}`)).json()) as {
      spec: { root: { props: { title: string } } };
    };
    expect(renderA.spec.root.props.title).toBe('Acme Home');
    expect(renderB.spec.root.props.title).toBe('Globex Home');
  });

  it('scopes comments to the project behind the share token', async () => {
    const { app, db } = await scopedApp();
    const a = await project(db, 'acme');
    const b = await project(db, 'globex');
    const tokenA = await deployHome(app, a, 'Acme Home');
    const tokenB = await deployHome(app, b, 'Globex Home');

    const posted = await app.request(`/share/${tokenA}/comments`, {
      method: 'POST',
      headers: json({}),
      body: JSON.stringify({ elementId: 'el-0', body: 'Acme note' }),
    });
    expect(posted.status).toBe(201);

    const acmeComments = (await (await app.request(`/share/${tokenA}/comments`)).json()) as unknown[];
    const globexComments = (await (
      await app.request(`/share/${tokenB}/comments`)
    ).json()) as unknown[];
    expect(acmeComments).toHaveLength(1);
    expect(globexComments).toHaveLength(0); // globex's identical screen id keeps its own comments

    // Internal per-screen aggregation is project-scoped too.
    const agg = await app.request('/screens/home/comments', { headers: a });
    expect(agg.status).toBe(200);
    expect((await agg.json()) as { versions: unknown }).toHaveProperty('versions');
  });
});
