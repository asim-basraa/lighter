import { describe, it, expect, afterEach } from 'vitest';
import { SpecSchema } from '@lighter/spec';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, runMigrations } from '@lighter/db';
import type { Spec } from '@lighter/spec';
import { createApp } from './app.js';
import { SpecStore } from './specStore.js';

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
  root = mkdtempSync(join(tmpdir(), 'lighter-handoff-api-'));
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

/** Create screen "checkout" with one saved version. Optionally approve it. */
async function seed(app: Awaited<ReturnType<typeof testApp>>, approve = false) {
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
  if (approve) {
    await app.request('/screens/checkout/versions/1/share', { method: 'POST' }); // → shared
    await app.request('/screens/checkout/versions/1/approve', { method: 'POST' }); // → approved
  }
}

const exportBundle = (app: Awaited<ReturnType<typeof testApp>>) =>
  app.request('/screens/checkout/versions/1/export');

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('export handoff bundle (#33)', () => {
  it('exports a bundle with all required artifacts for an approved version', async () => {
    const app = await testApp();
    await seed(app, true);
    await app.request('/screens/checkout/intent', {
      method: 'PUT',
      body: JSON.stringify({ intent: '# Checkout\nTake payment.' }),
      headers: json,
    });

    const res = await exportBundle(app);
    expect(res.status).toBe(200);
    const bundle = (await res.json()) as Record<string, unknown>;

    // All required artifacts present.
    expect(bundle.spec).toEqual(spec);
    expect(typeof bundle.catalogPrompt).toBe('string');
    expect(bundle.catalogPrompt as string).toContain('### Button');
    expect(Array.isArray(bundle.tokens)).toBe(true);
    expect((bundle.tokens as unknown[]).length).toBeGreaterThan(0);
    expect(bundle.intent).toBe('# Checkout\nTake payment.');
    expect(typeof bundle.reactExport).toBe('string');
    // The React export is a runnable component that renders the spec via the design system.
    expect(bundle.reactExport as string).toContain("from 'lighter-example/ui'");
    expect(bundle.reactExport as string).toContain('export default function Screen()');
    expect(bundle.reactExport as string).toContain('SpecView');
    expect(bundle).toMatchObject({ screen: { id: 'checkout', name: 'Checkout' }, version: 1 });
  });

  it('includes an empty intent when none was authored', async () => {
    const app = await testApp();
    await seed(app, true);
    const bundle = (await (await exportBundle(app)).json()) as { intent: string };
    expect(bundle.intent).toBe('');
  });

  it('403s exporting a version that is not approved', async () => {
    const app = await testApp();
    await seed(app, false); // draft
    const res = await exportBundle(app);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ state: 'draft' });
  });

  it('403s a shared-but-not-approved version', async () => {
    const app = await testApp();
    await seed(app, false);
    await app.request('/screens/checkout/versions/1/share', { method: 'POST' }); // shared, not approved
    expect((await exportBundle(app)).status).toBe(403);
  });

  it('404s an unknown version', async () => {
    const app = await testApp();
    await seed(app, true);
    expect((await app.request('/screens/checkout/versions/9/export')).status).toBe(404);
  });

  it('422s (not 500) an approved spec that cannot serialize to React', async () => {
    const app = await testApp();
    await seed(app, false);
    // A spec with a reserved-key prop passes structural parse but can't serialize to json-render.
    // Write it directly (bypassing save-time catalog validation), then approve and export.
    writeFileSync(
      join(root, 'checkout', '1.json'),
      JSON.stringify({ root: { type: 'Modal', props: { visible: true }, children: [] } }),
    );
    await app.request('/screens/checkout/versions/1/share', { method: 'POST' });
    await app.request('/screens/checkout/versions/1/approve', { method: 'POST' });
    const res = await exportBundle(app);
    expect(res.status).toBe(422);
    expect(JSON.stringify(await res.json())).toMatch(/cannot be exported/i);
  });
});
