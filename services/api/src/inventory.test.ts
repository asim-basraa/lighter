import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, runMigrations } from '@lighter/db';
import { createApp } from './app.js';

// The ingestion package's committed example fixture (monorepo-relative, always present).
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

  it('POST /ingest with a nonexistent repo is 422', async () => {
    const res = await testApp().request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: '/no/such/design-system' }),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(422);
  });
});
