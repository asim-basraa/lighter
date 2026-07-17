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

async function testApp({ withStore = true }: { withStore?: boolean } = {}) {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  let specStore: SpecStore | undefined;
  if (withStore) {
    root = mkdtempSync(join(tmpdir(), 'lighter-shares-api-'));
    specStore = new SpecStore(root);
    await specStore.init();
  }
  const app = createApp({ db, specStore });
  if (withStore) {
    await app.request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: fixtureRepo, artifactDir: 'artifacts' }),
      headers: json,
    });
  }
  return app;
}

/** Create a screen with one saved spec version. */
async function seedScreen(app: Awaited<ReturnType<typeof testApp>>) {
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
}

const share = (app: Awaited<ReturnType<typeof testApp>>, id: string, version: number) =>
  app.request(`/screens/${id}/versions/${version}/share`, { method: 'POST' });

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('tokenized share URL (#21)', () => {
  it('deploys a version to a token, and the token resolves to the rendered spec', async () => {
    const app = await testApp();
    await seedScreen(app);

    const deployed = await share(app, 'checkout', 1);
    expect(deployed.status).toBe(201);
    const { token } = (await deployed.json()) as { token: string };
    expect(token).toMatch(/^[0-9a-f]{32}$/);

    // The public read endpoint — no account — returns the screen, version, and spec to render.
    const res = await app.request(`/share/${token}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      screen: { id: 'checkout', name: 'Checkout' },
      version: 1,
      spec,
    });
  });

  it('returns the same stable token when a version is deployed twice', async () => {
    const app = await testApp();
    await seedScreen(app);
    const a = (await (await share(app, 'checkout', 1)).json()) as { token: string };
    const b = (await (await share(app, 'checkout', 1)).json()) as { token: string };
    expect(b.token).toBe(a.token);
  });

  it('404s deploying a version that does not exist', async () => {
    const app = await testApp();
    await seedScreen(app); // only v1 exists
    expect((await share(app, 'checkout', 2)).status).toBe(404);
    expect((await share(app, 'nope', 1)).status).toBe(404);
  });

  it('400s a non-positive version', async () => {
    const app = await testApp();
    await seedScreen(app);
    expect((await share(app, 'checkout', 0)).status).toBe(400);
  });

  it('404s an unknown share token', async () => {
    const app = await testApp();
    const res = await app.request(`/share/${'ab'.repeat(16)}`);
    expect(res.status).toBe(404);
  });

  it('404s the share routes when no spec store is configured', async () => {
    const noStore = await testApp({ withStore: false });
    expect(
      (await noStore.request('/screens/checkout/versions/1/share', { method: 'POST' })).status,
    ).toBe(404);
    expect((await noStore.request(`/share/${'ab'.repeat(16)}`)).status).toBe(404);
  });
});
