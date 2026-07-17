import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, runMigrations } from '@lighter/db';
import type { Spec } from '@lighter/spec';
import { createApp } from './app.js';
import { SpecStore } from './specStore.js';

const spec: Spec = {
  root: {
    type: 'PageShell',
    props: { title: 'Checkout' },
    children: [{ type: 'Text', props: { content: 'Hello', size: 'md' }, children: [] }],
  },
};

// The committed design-system fixture; ingested so specs have a catalog to validate against.
const fixtureRepo = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'packages',
  'ingestion',
  'fixtures',
  'example-ds',
);

let root: string;

/** An app with an in-memory DB, a temp git-backed spec store, and the fixture catalog ingested. */
async function testApp({ ingest = true }: { ingest?: boolean } = {}) {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  root = mkdtempSync(join(tmpdir(), 'lighter-specs-api-'));
  const specStore = new SpecStore(root);
  await specStore.init();
  const app = createApp({ db, specStore });
  if (ingest) {
    await app.request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: fixtureRepo, artifactDir: 'artifacts' }),
      headers: { 'content-type': 'application/json' },
    });
  }
  return app;
}

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('screen + spec-version API', () => {
  it('creates a screen, versions it, and fetches the version back', async () => {
    const app = await testApp();

    const created = await app.request('/screens', {
      method: 'POST',
      body: JSON.stringify({ name: 'Checkout' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ id: 'checkout', name: 'Checkout' });

    const v1 = await app.request('/screens/checkout/versions', {
      method: 'POST',
      body: JSON.stringify({ spec }),
      headers: { 'content-type': 'application/json' },
    });
    expect(v1.status).toBe(201);
    expect(await v1.json()).toEqual({ version: 1 });

    const v2 = await app.request('/screens/checkout/versions', {
      method: 'POST',
      body: JSON.stringify({ spec }),
      headers: { 'content-type': 'application/json' },
    });
    expect(await v2.json()).toEqual({ version: 2 });

    const meta = await app.request('/screens/checkout');
    expect(meta.status).toBe(200);
    expect(await meta.json()).toEqual({ id: 'checkout', name: 'Checkout', versions: [1, 2] });

    const fetched = await app.request('/screens/checkout/versions/1');
    expect(fetched.status).toBe(200);
    expect(await fetched.json()).toEqual({ version: 1, spec });
  });

  it('lists screens', async () => {
    const app = await testApp();
    await app.request('/screens', {
      method: 'POST',
      body: JSON.stringify({ name: 'Settings' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await app.request('/screens');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'settings', name: 'Settings' }]);
  });

  it('409s on a duplicate screen', async () => {
    const app = await testApp();
    const body = JSON.stringify({ name: 'Checkout' });
    const headers = { 'content-type': 'application/json' };
    await app.request('/screens', { method: 'POST', body, headers });
    const dupe = await app.request('/screens', { method: 'POST', body, headers });
    expect(dupe.status).toBe(409);
  });

  it('400s a missing name and a missing spec', async () => {
    const app = await testApp();
    const noName = await app.request('/screens', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });
    expect(noName.status).toBe(400);

    await app.request('/screens', {
      method: 'POST',
      body: JSON.stringify({ name: 'Checkout' }),
      headers: { 'content-type': 'application/json' },
    });
    const badSpec = await app.request('/screens/checkout/versions', {
      method: 'POST',
      body: JSON.stringify({ spec: { root: { props: {} } } }),
      headers: { 'content-type': 'application/json' },
    });
    expect(badSpec.status).toBe(400);
    expect(((await badSpec.json()) as { issues?: unknown }).issues).toBeDefined();
  });

  it('does not let a traversal id escape the store over HTTP', async () => {
    const app = await testApp();
    // Percent-encoded slashes survive URL parsing as a single :id param → must be refused.
    expect((await app.request('/screens/..%2f..%2fetc')).status).toBe(404);
    expect((await app.request('/screens/..%2f..%2fetc/versions/1')).status).toBe(404);
    const write = await app.request('/screens/..%2f..%2fetc/versions', {
      method: 'POST',
      body: JSON.stringify({ spec }),
      headers: { 'content-type': 'application/json' },
    });
    expect(write.status).toBe(404);
  });

  it('404s an unknown screen and an unknown version', async () => {
    const app = await testApp();
    expect((await app.request('/screens/nope')).status).toBe(404);
    expect((await app.request('/screens/nope/versions/1')).status).toBe(404);
    const orphanVersion = await app.request('/screens/nope/versions', {
      method: 'POST',
      body: JSON.stringify({ spec }),
      headers: { 'content-type': 'application/json' },
    });
    expect(orphanVersion.status).toBe(404);
  });
});

describe('spec catalog validation on save (#15)', () => {
  const post = (app: Awaited<ReturnType<typeof testApp>>, path: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });

  it('saves a catalog-valid edit as a new version', async () => {
    const app = await testApp();
    await post(app, '/screens', { name: 'Checkout' });
    const res = await post(app, '/screens/checkout/versions', { spec });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ version: 1 });
  });

  it('rejects an unknown component with structured issues and saves nothing', async () => {
    const app = await testApp();
    await post(app, '/screens', { name: 'Checkout' });
    const badSpec: Spec = { root: { type: 'Ghost', props: {}, children: [] } };
    const res = await post(app, '/screens/checkout/versions', { spec: badSpec });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { issues: { code: string; component: string }[] };
    expect(body.issues[0]).toMatchObject({ code: 'unknown-component', component: 'Ghost' });
    // Nothing was persisted.
    expect(await (await app.request('/screens/checkout')).json()).toMatchObject({ versions: [] });
  });

  it('rejects props that violate the catalog schema', async () => {
    const app = await testApp();
    await post(app, '/screens', { name: 'Checkout' });
    const badProps: Spec = {
      root: { type: 'Text', props: { content: 'x', size: 'ENORMOUS' }, children: [] },
    };
    const res = await post(app, '/screens/checkout/versions', { spec: badProps });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { issues: { code: string }[] };
    expect(body.issues.some((i) => i.code === 'invalid-props')).toBe(true);
  });

  it('400s (not 500s) a prototype-key component type', async () => {
    const app = await testApp();
    await post(app, '/screens', { name: 'Checkout' });
    const res = await post(app, '/screens/checkout/versions', {
      spec: { root: { type: 'constructor', props: {}, children: [] } },
    });
    expect(res.status).toBe(400);
  });

  it('422s a save when no catalog has been ingested', async () => {
    const app = await testApp({ ingest: false });
    await post(app, '/screens', { name: 'Checkout' });
    const res = await post(app, '/screens/checkout/versions', { spec });
    expect(res.status).toBe(422);
  });
});

describe('duplicate a screen (#16)', () => {
  const post = (app: Awaited<ReturnType<typeof testApp>>, path: string, body: unknown) =>
    app.request(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });

  async function seeded() {
    const app = await testApp();
    await post(app, '/screens', { name: 'Checkout' });
    await post(app, '/screens/checkout/versions', { spec });
    return app;
  }

  it('duplicates into an independent new screen whose v1 copies the source', async () => {
    const app = await seeded();

    const res = await post(app, '/screens/checkout/duplicate', { name: 'Checkout Copy' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'checkout-copy', name: 'Checkout Copy', version: 1 });

    // The copy's v1 spec equals the source's.
    const copySpec = await (await app.request('/screens/checkout-copy/versions/1')).json();
    expect(copySpec).toEqual({ version: 1, spec });

    // The original is unchanged.
    expect(await (await app.request('/screens/checkout')).json()).toMatchObject({ versions: [1] });

    // Independence: versioning the copy does not touch the source.
    await post(app, '/screens/checkout-copy/versions', { spec });
    expect(await (await app.request('/screens/checkout-copy')).json()).toMatchObject({
      versions: [1, 2],
    });
    expect(await (await app.request('/screens/checkout')).json()).toMatchObject({ versions: [1] });
  });

  it('404s duplicating a missing source and 422s a spec-less source', async () => {
    const app = await testApp();
    expect((await post(app, '/screens/nope/duplicate', { name: 'X' })).status).toBe(404);
    await post(app, '/screens', { name: 'Empty' });
    expect((await post(app, '/screens/empty/duplicate', { name: 'X' })).status).toBe(422);
  });

  it('409s duplicating onto an existing name and 400s a missing name', async () => {
    const app = await seeded();
    await post(app, '/screens', { name: 'Taken' });
    expect((await post(app, '/screens/checkout/duplicate', { name: 'Taken' })).status).toBe(409);
    expect((await post(app, '/screens/checkout/duplicate', {})).status).toBe(400);
  });
});
