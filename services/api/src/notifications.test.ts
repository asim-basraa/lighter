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
import type { Notification, Notifier } from './notifier.js';

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

/** A notifier that records events; optionally throws to prove failures don't break the action. */
function recordingNotifier(fail = false): Notifier & { events: Notification[] } {
  const events: Notification[] = [];
  return {
    events,
    async notify(n) {
      events.push(n);
      if (fail) throw new Error('sink down');
    },
  };
}

async function testApp(notifier?: Notifier) {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  root = mkdtempSync(join(tmpdir(), 'lighter-notify-api-'));
  const specStore = new SpecStore(root);
  await specStore.init();
  const app = createApp({ db, specStore, notifier });
  await app.request('/ingest', {
    method: 'POST',
    body: JSON.stringify({ repoPath: fixtureRepo, artifactDir: 'artifacts' }),
    headers: json,
  });
  return app;
}

async function seedShared(app: Awaited<ReturnType<typeof testApp>>): Promise<string> {
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
  const token = (
    (await (
      await app.request('/screens/checkout/versions/1/share', { method: 'POST' })
    ).json()) as { token: string }
  ).token;
  return token;
}

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('notifications on comment / approval (#29)', () => {
  it('emits a comment notification when a comment is left', async () => {
    const notifier = recordingNotifier();
    const app = await testApp(notifier);
    const token = await seedShared(app);
    await app.request(`/share/${token}/comments`, {
      method: 'POST',
      body: JSON.stringify({ elementId: 'el-1', body: 'Tighten spacing', author: 'Dana' }),
      headers: json,
    });
    expect(notifier.events).toEqual([
      {
        kind: 'comment',
        screenId: 'checkout',
        version: 1,
        elementId: 'el-1',
        author: 'Dana',
        body: 'Tighten spacing',
        parentId: null,
      },
    ]);
  });

  it('a reply emits a comment notification that carries its parentId', async () => {
    const notifier = recordingNotifier();
    const app = await testApp(notifier);
    const token = await seedShared(app);
    const root = (await (
      await app.request(`/share/${token}/comments`, {
        method: 'POST',
        body: JSON.stringify({ elementId: 'el-1', body: 'root' }),
        headers: json,
      })
    ).json()) as { id: number };
    await app.request(`/share/${token}/comments`, {
      method: 'POST',
      body: JSON.stringify({ parentId: root.id, body: 'a reply' }),
      headers: json,
    });
    const reply = notifier.events.at(-1) as { kind: string; parentId: number | null; body: string };
    expect(reply).toMatchObject({ kind: 'comment', body: 'a reply', parentId: root.id });
  });

  it('emits an approval notification when a version is approved', async () => {
    const notifier = recordingNotifier();
    const app = await testApp(notifier);
    await seedShared(app); // draft → shared
    await app.request('/screens/checkout/versions/1/approve', { method: 'POST' });
    expect(notifier.events).toEqual([{ kind: 'approval', screenId: 'checkout', version: 1 }]);
  });

  it('does not notify on a blocked (409) approval', async () => {
    const notifier = recordingNotifier();
    const app = await testApp(notifier);
    await seedShared(app);
    // Illegal: draft(after nothing)… actually request-changes from shared is legal; approve then
    // request-changes is illegal — use that to force a 409 with no state change.
    await app.request('/screens/checkout/versions/1/approve', { method: 'POST' }); // approved
    notifier.events.length = 0;
    const res = await app.request('/screens/checkout/versions/1/request-changes', {
      method: 'POST',
    });
    expect(res.status).toBe(409);
    expect(notifier.events).toEqual([]); // no notification on a rejected transition
  });

  it('does not notify when approval is blocked by an incomplete sign-off (409)', async () => {
    const notifier = recordingNotifier();
    const app = await testApp(notifier);
    await seedShared(app);
    // Configure a sign-off set so approve is gated (#26), then approve with nothing signed.
    await app.request('/screens/checkout/sign-off-set', {
      method: 'PUT',
      body: JSON.stringify({
        parties: [
          { party: 'acme', role: 'customer' },
          { party: 'lead', role: 'internal' },
        ],
      }),
      headers: json,
    });
    const res = await app.request('/screens/checkout/versions/1/approve', { method: 'POST' });
    expect(res.status).toBe(409);
    expect(notifier.events).toEqual([]); // gated approval must not notify
  });

  it('notifies once on approval, not again on an idempotent re-approve', async () => {
    const notifier = recordingNotifier();
    const app = await testApp(notifier);
    await seedShared(app);
    await app.request('/screens/checkout/versions/1/approve', { method: 'POST' });
    await app.request('/screens/checkout/versions/1/approve', { method: 'POST' }); // idempotent 200
    expect(notifier.events.filter((e) => e.kind === 'approval')).toHaveLength(1);
  });

  it('request-changes does not notify', async () => {
    const notifier = recordingNotifier();
    const app = await testApp(notifier);
    await seedShared(app); // shared
    await app.request('/screens/checkout/versions/1/request-changes', { method: 'POST' });
    expect(notifier.events).toEqual([]);
  });

  it('a notifier failure does not break the comment (still 201)', async () => {
    const app = await testApp(recordingNotifier(true));
    const token = await seedShared(app);
    const res = await app.request(`/share/${token}/comments`, {
      method: 'POST',
      body: JSON.stringify({ elementId: 'el-1', body: 'still works' }),
      headers: json,
    });
    expect(res.status).toBe(201);
  });

  it('works with no notifier configured (no throw)', async () => {
    const app = await testApp(); // no notifier
    const token = await seedShared(app);
    const res = await app.request(`/share/${token}/comments`, {
      method: 'POST',
      body: JSON.stringify({ elementId: 'el-1', body: 'ok' }),
      headers: json,
    });
    expect(res.status).toBe(201);
  });
});
