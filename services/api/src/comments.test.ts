import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, runMigrations } from '@lighter/db';
import type { Spec } from '@lighter/spec';
import { createApp } from './app.js';
import { SpecStore } from './specStore.js';

// root PageShell (el-0) → Button (el-1): the valid anchor ids for this version are el-0, el-1.
const spec: Spec = {
  root: {
    type: 'PageShell',
    props: { title: 'Checkout' },
    children: [{ type: 'Button', props: { label: 'Pay', variant: 'primary' }, children: [] }],
  },
};

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

const json = { 'content-type': 'application/json' };
let root: string;

async function testApp() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  root = mkdtempSync(join(tmpdir(), 'lighter-comments-api-'));
  const specStore = new SpecStore(root);
  await specStore.init();
  const app = createApp({ db, specStore });
  await app.request('/ingest', {
    method: 'POST',
    body: JSON.stringify({ repoPath: fixtureRepo, artifactDir: 'artifacts' }),
    headers: json,
  });
  return app;
}

/** Create a screen with one saved version and deploy it; return its share token. */
async function seedShare(app: Awaited<ReturnType<typeof testApp>>): Promise<string> {
  await app.request('/screens', {
    method: 'POST',
    body: JSON.stringify({ name: 'Checkout' }),
    headers: json,
  });
  await app.request('/screens/checkout/versions', {
    method: 'POST',
    body: JSON.stringify({ spec }),
    headers: json,
  });
  const res = await app.request('/screens/checkout/versions/1/share', { method: 'POST' });
  return ((await res.json()) as { token: string }).token;
}

const postComment = (
  app: Awaited<ReturnType<typeof testApp>>,
  token: string,
  body: Record<string, unknown>,
) =>
  app.request(`/share/${token}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: json,
  });

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('element-anchored comments (#23)', () => {
  it('leaves a comment on an element and lists it back — no account', async () => {
    const app = await testApp();
    const token = await seedShare(app);

    const created = await postComment(app, token, {
      elementId: 'el-1',
      body: 'Should this be secondary?',
      author: 'Dana',
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      elementId: 'el-1',
      body: 'Should this be secondary?',
      author: 'Dana',
    });

    const list = await app.request(`/share/${token}/comments`);
    expect(list.status).toBe(200);
    const comments = (await list.json()) as { elementId: string; body: string }[];
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ elementId: 'el-1', body: 'Should this be secondary?' });
  });

  it('accepts an anonymous comment (no author)', async () => {
    const app = await testApp();
    const token = await seedShare(app);
    const res = await postComment(app, token, { elementId: 'el-0', body: 'Looks good' });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { author: string | null }).author).toBeNull();
  });

  it('422s a comment anchored to an element that is not in the spec', async () => {
    const app = await testApp();
    const token = await seedShare(app);
    const res = await postComment(app, token, { elementId: 'el-999', body: 'ghost anchor' });
    expect(res.status).toBe(422);
  });

  it('400s an empty body or missing elementId', async () => {
    const app = await testApp();
    const token = await seedShare(app);
    expect((await postComment(app, token, { elementId: 'el-1', body: '   ' })).status).toBe(400);
    expect((await postComment(app, token, { body: 'no anchor' })).status).toBe(400);
  });

  it('400s an over-length body — a public write surface must bound stored size', async () => {
    const app = await testApp();
    const token = await seedShare(app);
    const huge = 'x'.repeat(4001);
    expect((await postComment(app, token, { elementId: 'el-1', body: huge })).status).toBe(400);
  });

  it('404s comments on an unknown share token', async () => {
    const app = await testApp();
    const bad = 'ab'.repeat(16);
    expect((await postComment(app, bad, { elementId: 'el-0', body: 'x' })).status).toBe(404);
    expect((await app.request(`/share/${bad}/comments`)).status).toBe(404);
  });
});
