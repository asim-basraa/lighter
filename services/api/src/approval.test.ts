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

async function testApp() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  root = mkdtempSync(join(tmpdir(), 'lighter-approval-api-'));
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

/** Create screen "checkout" with one saved version. */
async function seedVersion(app: Awaited<ReturnType<typeof testApp>>) {
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

const status = (app: Awaited<ReturnType<typeof testApp>>) =>
  app.request('/screens/checkout/versions/1/status');
const deploy = (app: Awaited<ReturnType<typeof testApp>>) =>
  app.request('/screens/checkout/versions/1/share', { method: 'POST' });
const requestChanges = (app: Awaited<ReturnType<typeof testApp>>) =>
  app.request('/screens/checkout/versions/1/request-changes', { method: 'POST' });
const approve = (app: Awaited<ReturnType<typeof testApp>>) =>
  app.request('/screens/checkout/versions/1/approve', { method: 'POST' });

const stateOf = async (res: Response) => ((await res.json()) as { state: string }).state;

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('approval state machine (#25)', () => {
  it('a fresh version is draft', async () => {
    const app = await testApp();
    await seedVersion(app);
    const res = await status(app);
    expect(res.status).toBe(200);
    expect(await stateOf(res)).toBe('draft');
  });

  it('deploying advances draft → shared', async () => {
    const app = await testApp();
    await seedVersion(app);
    await deploy(app);
    expect(await stateOf(await status(app))).toBe('shared');
  });

  it('request-changes then approve walks shared → changes-requested → approved', async () => {
    const app = await testApp();
    await seedVersion(app);
    await deploy(app); // shared
    expect(await stateOf(await requestChanges(app))).toBe('changes-requested');
    expect(await stateOf(await approve(app))).toBe('approved');
    expect(await stateOf(await status(app))).toBe('approved');
  });

  it('approves directly from shared', async () => {
    const app = await testApp();
    await seedVersion(app);
    await deploy(app);
    expect((await approve(app)).status).toBe(200);
    expect(await stateOf(await status(app))).toBe('approved');
  });

  it('rejects an illegal transition with 409 and does not change state', async () => {
    const app = await testApp();
    await seedVersion(app); // draft, not yet shared
    const res = await requestChanges(app); // draft → changes-requested is illegal
    expect(res.status).toBe(409);
    expect(await stateOf(await status(app))).toBe('draft');
  });

  it('approved is terminal: request-changes on it is 409', async () => {
    const app = await testApp();
    await seedVersion(app);
    await deploy(app);
    await approve(app);
    expect((await requestChanges(app)).status).toBe(409);
  });

  it('approve is idempotent when already approved (200, stays approved)', async () => {
    const app = await testApp();
    await seedVersion(app);
    await deploy(app);
    await approve(app);
    expect((await approve(app)).status).toBe(200);
    expect(await stateOf(await status(app))).toBe('approved');
  });

  it('re-deploying an approved version leaves it approved', async () => {
    const app = await testApp();
    await seedVersion(app);
    await deploy(app);
    await approve(app);
    await deploy(app); // no-op on state
    expect(await stateOf(await status(app))).toBe('approved');
  });

  it('re-deploying does not reset a changes-requested version', async () => {
    const app = await testApp();
    await seedVersion(app);
    await deploy(app); // shared
    await requestChanges(app); // changes-requested
    await deploy(app); // idempotent share; must NOT move it back to shared
    expect(await stateOf(await status(app))).toBe('changes-requested');
  });

  it('404s status/transitions for a version that does not exist', async () => {
    const app = await testApp();
    await seedVersion(app);
    expect((await app.request('/screens/checkout/versions/9/status')).status).toBe(404);
    expect(
      (await app.request('/screens/checkout/versions/9/approve', { method: 'POST' })).status,
    ).toBe(404);
  });
});
