import { describe, it, expect, afterEach } from 'vitest';
import { SpecSchema } from '@lighter/spec';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, runMigrations } from '@lighter/db';
import type { Spec } from '@lighter/spec';
import { createApp } from './app.js';
import { SpecStore } from './specStore.js';

// root PageShell (el-0) → Button (el-1): the valid anchor ids for this version are el-0, el-1.
const spec: Spec = SpecSchema.parse({
  root: {
    type: 'PageShell',
    props: { title: 'Checkout' },
    children: [{ type: 'Button', props: { label: 'Pay', variant: 'primary' }, children: [] }],
  },
});

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

/** Create a named screen with one saved version and deploy it; return its share token. */
async function seedShareNamed(
  app: Awaited<ReturnType<typeof testApp>>,
  name: string,
): Promise<string> {
  const created = (await (
    await app.request('/screens', {
      method: 'POST',
      body: JSON.stringify({ name }),
      headers: json,
    })
  ).json()) as { id: string };
  await app.request(`/screens/${created.id}/versions`, {
    method: 'POST',
    body: JSON.stringify({ spec }),
    headers: json,
  });
  const res = await app.request(`/screens/${created.id}/versions/1/share`, { method: 'POST' });
  return ((await res.json()) as { token: string }).token;
}

/** Create the 'Checkout' screen with one saved version and deploy it; return its share token. */
const seedShare = (app: Awaited<ReturnType<typeof testApp>>) => seedShareNamed(app, 'Checkout');

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

  it('replies to a comment, inheriting the parent element, scoped to the version', async () => {
    const app = await testApp();
    const token = await seedShare(app);
    const root = (await (
      await postComment(app, token, { elementId: 'el-1', body: 'root note' })
    ).json()) as { id: number; elementId: string };

    const replied = await postComment(app, token, { parentId: root.id, body: 'a reply' });
    expect(replied.status).toBe(201);
    const reply = (await replied.json()) as { parentId: number; elementId: string };
    expect(reply.parentId).toBe(root.id);
    expect(reply.elementId).toBe('el-1'); // inherited from the parent, not client-supplied

    const list = (await (await app.request(`/share/${token}/comments`)).json()) as {
      body: string;
      parentId: number | null;
    }[];
    expect(list.map((c) => [c.body, c.parentId])).toEqual([
      ['root note', null],
      ['a reply', root.id],
    ]);
  });

  it('rejects replying to a reply (threads are one level deep)', async () => {
    const app = await testApp();
    const token = await seedShare(app);
    const root = (await (
      await postComment(app, token, { elementId: 'el-0', body: 'root' })
    ).json()) as { id: number };
    const reply = (await (
      await postComment(app, token, { parentId: root.id, body: 'reply' })
    ).json()) as { id: number };
    const res = await postComment(app, token, { parentId: reply.id, body: 'nested' });
    expect(res.status).toBe(400);
  });

  it('404s a reply whose parent is not in this version', async () => {
    const app = await testApp();
    const token = await seedShare(app);
    const res = await postComment(app, token, { parentId: 9999, body: 'orphan' });
    expect(res.status).toBe(404);
  });

  it('404s a reply to a parent that exists but belongs to another screen (no cross-scope)', async () => {
    const app = await testApp();
    const [tokenA, tokenB] = [await seedShare(app), await seedShareNamed(app, 'Other')];
    // A real root comment on screen B.
    const rootB = (await (
      await postComment(app, tokenB, { elementId: 'el-0', body: 'on other screen' })
    ).json()) as { id: number };
    // Screen A's token must not be able to reply to screen B's comment.
    const res = await postComment(app, tokenA, { parentId: rootB.id, body: 'cross-scope' });
    expect(res.status).toBe(404);
  });

  it('400s a non-integer parentId (float or numeric string)', async () => {
    const app = await testApp();
    const token = await seedShare(app);
    expect((await postComment(app, token, { parentId: 1.5, body: 'x' })).status).toBe(400);
    expect((await postComment(app, token, { parentId: '1', body: 'x' })).status).toBe(400);
  });

  it('404s comments on an unknown share token', async () => {
    const app = await testApp();
    const bad = 'ab'.repeat(16);
    expect((await postComment(app, bad, { elementId: 'el-0', body: 'x' })).status).toBe(404);
    expect((await app.request(`/share/${bad}/comments`)).status).toBe(404);
  });
});

describe('comments aggregated per element/version (#27)', () => {
  it('groups a screen’s comments by version + element with thread contents', async () => {
    const app = await testApp();
    const token = await seedShare(app); // screen "checkout", v1
    const root = (await (
      await postComment(app, token, { elementId: 'el-1', body: 'root note' })
    ).json()) as { id: number };
    await postComment(app, token, { parentId: root.id, body: 'a reply' });
    await postComment(app, token, { elementId: 'el-0', body: 'other element' });

    const res = await app.request('/screens/checkout/comments');
    expect(res.status).toBe(200);
    const agg = (await res.json()) as {
      screen: string;
      versions: {
        version: number;
        elements: {
          elementId: string;
          threads: { root: { body: string }; replies: { body: string }[] }[];
        }[];
      }[];
    };
    expect(agg.screen).toBe('checkout');
    expect(agg.versions).toHaveLength(1);
    expect(agg.versions[0]!.version).toBe(1);
    const els = agg.versions[0]!.elements;
    expect(els.map((e) => e.elementId)).toEqual(['el-1', 'el-0']);
    // Thread contents are included: the reply is nested under its root.
    expect(els[0]!.threads[0]!.root.body).toBe('root note');
    expect(els[0]!.threads[0]!.replies.map((r) => r.body)).toEqual(['a reply']);
  });

  it('404s aggregation for an unknown screen', async () => {
    const app = await testApp();
    expect((await app.request('/screens/nope/comments')).status).toBe(404);
  });
});
