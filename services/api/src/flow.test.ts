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
    props: { title: 'Screen' },
    children: [{ type: 'Button', props: { label: 'Go', variant: 'primary' }, children: [] }],
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
  root = mkdtempSync(join(tmpdir(), 'lighter-flow-api-'));
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

/** Create a screen (by name → slug) with one saved version; return its slug. Optionally deploy it. */
async function makeScreen(
  app: Awaited<ReturnType<typeof testApp>>,
  name: string,
  deploy = false,
): Promise<string> {
  const created = (await (
    await app.request('/screens', { method: 'POST', body: JSON.stringify({ name }), headers: json })
  ).json()) as { id: string };
  await app.request(`/screens/${created.id}/versions`, {
    method: 'POST',
    body: JSON.stringify({ spec }),
    headers: json,
  });
  let token: string | null = null;
  if (deploy) {
    token = (
      (await (
        await app.request(`/screens/${created.id}/versions/1/share`, { method: 'POST' })
      ).json()) as { token: string }
    ).token;
  }
  return created.id + (token ? `|${token}` : '');
}

const setFlow = (app: Awaited<ReturnType<typeof testApp>>, id: string, links: unknown) =>
  app.request(`/screens/${id}/flow`, {
    method: 'PUT',
    body: JSON.stringify({ links }),
    headers: json,
  });

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('click-through flows (#30)', () => {
  it('configures a flow and reads it back', async () => {
    const app = await testApp();
    await makeScreen(app, 'Checkout');
    await makeScreen(app, 'Confirm');
    const res = await setFlow(app, 'checkout', [{ label: 'Continue', target: 'confirm' }]);
    expect(res.status).toBe(200);
    const got = (await (await app.request('/screens/checkout/flow')).json()) as {
      links: unknown[];
    };
    expect(got.links).toEqual([{ label: 'Continue', target: 'confirm' }]);
  });

  it('rejects a flow link to a non-existent target screen (400)', async () => {
    const app = await testApp();
    await makeScreen(app, 'Checkout');
    expect((await setFlow(app, 'checkout', [{ label: 'Go', target: 'ghost' }])).status).toBe(400);
  });

  it('400s a malformed link (null, empty, or whitespace-only fields)', async () => {
    const app = await testApp();
    await makeScreen(app, 'Checkout');
    await makeScreen(app, 'Confirm');
    expect((await setFlow(app, 'checkout', [null])).status).toBe(400);
    expect((await setFlow(app, 'checkout', [{ label: '', target: 'confirm' }])).status).toBe(400);
    expect((await setFlow(app, 'checkout', [{ label: '   ', target: 'confirm' }])).status).toBe(
      400,
    );
    expect((await setFlow(app, 'checkout', [{ label: 'Go', target: '   ' }])).status).toBe(400);
  });

  it('400s a flow with too many links', async () => {
    const app = await testApp();
    await makeScreen(app, 'Checkout');
    await makeScreen(app, 'Confirm');
    const many = Array.from({ length: 21 }, () => ({ label: 'Go', target: 'confirm' }));
    expect((await setFlow(app, 'checkout', many)).status).toBe(400);
  });

  it('404s flow read/write for a non-existent source screen', async () => {
    const app = await testApp();
    expect((await app.request('/screens/ghost/flow')).status).toBe(404);
    expect((await setFlow(app, 'ghost', [])).status).toBe(404);
  });

  it('resolves the flow to the target’s deployed mock in the share response', async () => {
    const app = await testApp();
    await makeScreen(app, 'Checkout');
    const confirmToken = (await makeScreen(app, 'Confirm', true)).split('|')[1]!;
    await setFlow(app, 'checkout', [{ label: 'Continue', target: 'confirm' }]);

    // Deploy checkout and read its share — the flow link resolves to confirm's deployed token.
    const token = (
      (await (
        await app.request('/screens/checkout/versions/1/share', { method: 'POST' })
      ).json()) as { token: string }
    ).token;
    const share = (await (await app.request(`/share/${token}`)).json()) as {
      flow: { label: string; targetScreenId: string; token: string | null }[];
    };
    expect(share.flow).toEqual([
      { label: 'Continue', targetScreenId: 'confirm', token: confirmToken },
    ]);
  });

  it('resolves an undeployed target to a null token (link disabled in the UI)', async () => {
    const app = await testApp();
    await makeScreen(app, 'Checkout');
    await makeScreen(app, 'Confirm'); // not deployed
    await setFlow(app, 'checkout', [{ label: 'Continue', target: 'confirm' }]);
    const token = (
      (await (
        await app.request('/screens/checkout/versions/1/share', { method: 'POST' })
      ).json()) as { token: string }
    ).token;
    const share = (await (await app.request(`/share/${token}`)).json()) as {
      flow: { token: string | null }[];
    };
    expect(share.flow[0]!.token).toBeNull();
  });
});
