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
  root = mkdtempSync(join(tmpdir(), 'lighter-signoff-api-'));
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

async function seedDeployed(app: Awaited<ReturnType<typeof testApp>>) {
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
  await app.request('/screens/checkout/versions/1/share', { method: 'POST' }); // draft → shared
}

const setSet = (app: Awaited<ReturnType<typeof testApp>>, parties: unknown) =>
  app.request('/screens/checkout/sign-off-set', {
    method: 'PUT',
    body: JSON.stringify({ parties }),
    headers: json,
  });
const signOff = (app: Awaited<ReturnType<typeof testApp>>, party: string) =>
  app.request('/screens/checkout/versions/1/sign-offs', {
    method: 'POST',
    body: JSON.stringify({ party }),
    headers: json,
  });
const approve = (app: Awaited<ReturnType<typeof testApp>>) =>
  app.request('/screens/checkout/versions/1/approve', { method: 'POST' });
const stateOf = async (app: Awaited<ReturnType<typeof testApp>>) =>
  ((await (await app.request('/screens/checkout/versions/1/status')).json()) as { state: string })
    .state;

const validSet = [
  { party: 'acme', role: 'customer' },
  { party: 'lead', role: 'internal' },
];

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('sign-off set enforcement (#26)', () => {
  it('configures and reads back a valid sign-off set', async () => {
    const app = await testApp();
    await seedDeployed(app);
    expect((await setSet(app, validSet)).status).toBe(200);
    const got = (await (await app.request('/screens/checkout/sign-off-set')).json()) as {
      parties: unknown[];
    };
    expect(got.parties).toEqual(validSet);
  });

  it('rejects a set without both a customer and an internal owner (400)', async () => {
    const app = await testApp();
    await seedDeployed(app);
    expect((await setSet(app, [{ party: 'acme', role: 'customer' }])).status).toBe(400);
    expect((await setSet(app, [{ party: 'lead', role: 'internal' }])).status).toBe(400);
  });

  it('blocks approve until the full set has signed; partial stays not-approved', async () => {
    const app = await testApp();
    await seedDeployed(app);
    await setSet(app, validSet);

    // No sign-offs yet → approve blocked.
    expect((await approve(app)).status).toBe(409);
    expect(await stateOf(app)).toBe('shared');

    // Partial sign-off → still blocked.
    const partial = await signOff(app, 'acme');
    expect(((await partial.json()) as { complete: boolean }).complete).toBe(false);
    expect((await approve(app)).status).toBe(409);
    expect(await stateOf(app)).toBe('shared');

    // Full sign-off → approve succeeds.
    const full = await signOff(app, 'lead');
    expect(((await full.json()) as { complete: boolean }).complete).toBe(true);
    expect((await approve(app)).status).toBe(200);
    expect(await stateOf(app)).toBe('approved');
  });

  it('rejects a sign-off from a party not in the set, and when no set is configured', async () => {
    const app = await testApp();
    await seedDeployed(app);
    // No set configured yet.
    expect((await signOff(app, 'acme')).status).toBe(400);
    await setSet(app, validSet);
    expect((await signOff(app, 'stranger')).status).toBe(400);
    expect((await signOff(app, 'acme')).status).toBe(200);
  });

  it('a screen with no configured set is ungated (approve works — #25 compatible)', async () => {
    const app = await testApp();
    await seedDeployed(app);
    expect((await approve(app)).status).toBe(200);
    expect(await stateOf(app)).toBe('approved');
  });

  it('400s a malformed parties element instead of throwing a 500', async () => {
    const app = await testApp();
    await seedDeployed(app);
    expect((await setSet(app, [null])).status).toBe(400);
    expect((await setSet(app, ['not-an-object'])).status).toBe(400);
  });

  it('growing the set after a complete sign-off re-blocks approve', async () => {
    const app = await testApp();
    await seedDeployed(app);
    await setSet(app, validSet);
    await signOff(app, 'acme');
    await signOff(app, 'lead'); // set complete for the current set
    // Add a third required party before approving.
    await setSet(app, [...validSet, { party: 'qa', role: 'internal' }]);
    expect((await approve(app)).status).toBe(409); // qa hasn't signed
    await signOff(app, 'qa');
    expect((await approve(app)).status).toBe(200);
  });
});
