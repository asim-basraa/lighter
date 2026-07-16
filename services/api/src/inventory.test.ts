import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, runMigrations } from '@lighter/db';
import { createApp } from './app.js';

// The ingestion package's committed fixtures (monorepo-relative, always present).
const fixturesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'packages',
  'ingestion',
  'fixtures',
);
const fixtureRepo = join(fixturesRoot, 'example-ds');
const otherFixtureRepo = join(fixturesRoot, 'unhealthy-ds');

function testApp() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  return createApp({ db });
}

interface IngestBody {
  status: string;
  model?: { components: { name: string }[]; tokens: unknown[]; health: unknown[] };
  message?: string;
}

describe('ingestion API', () => {
  it('POST /ingest ingests a repo and returns the inventory model', async () => {
    const app = testApp();
    const res = await app.request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: fixtureRepo, artifactDir: 'artifacts' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as IngestBody;
    expect(body.status).toBe('ok');
    expect(body.model?.components.map((c) => c.name)).toContain('Button');
    expect(body.model?.tokens.length).toBeGreaterThan(0);
  });

  it('GET /inventory returns the last-ingested model', async () => {
    const app = testApp();
    await app.request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: fixtureRepo, artifactDir: 'artifacts' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await app.request('/inventory');
    expect(res.status).toBe(200);
    const model = (await res.json()) as { components: { name: string }[] };
    expect(model.components.map((c) => c.name)).toContain('PageShell');
  });

  it('GET /inventory returns the LATEST across separate ingests, proving persisted id-desc ordering', async () => {
    const app = testApp();
    // First request persists the example-ds snapshot (contains PageShell).
    const first = await app.request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: fixtureRepo, artifactDir: 'artifacts' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(first.status).toBe(201);
    // A second, separate request persists a different snapshot (unhealthy-ds: Widget, no PageShell).
    const second = await app.request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: otherFixtureRepo, artifactDir: 'artifacts' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(second.status).toBe(201);

    // GET must return the newest snapshot — not the first — which only holds if the read goes
    // through the DB and latestInventory orders by id descending.
    const res = await app.request('/inventory');
    expect(res.status).toBe(200);
    const model = (await res.json()) as { components: { name: string }[] };
    const names = model.components.map((c) => c.name);
    expect(names).toContain('Widget');
    expect(names).not.toContain('PageShell');
  });

  it('GET /inventory is 404 before anything is ingested', async () => {
    const res = await testApp().request('/inventory');
    expect(res.status).toBe(404);
  });

  it('POST /ingest without a repoPath is 400', async () => {
    const res = await testApp().request('/ingest', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('POST /ingest rejects a traversal artifactDir with 400', async () => {
    const res = await testApp().request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: fixtureRepo, artifactDir: '../../etc' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('POST /ingest with a nonexistent repo is 422', async () => {
    const res = await testApp().request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: '/no/such/design-system' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(422);
  });
});
