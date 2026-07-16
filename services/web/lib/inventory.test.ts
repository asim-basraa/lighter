import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, runMigrations } from '@lighter/db';
import { createApp } from '@lighter/api';
import { fetchInventory, loadInventory } from './inventory.js';

// The ingestion package's committed fixture — the same design-system snapshot the API test ingests.
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

/** A live in-process Lighter API over an in-memory DB, so `fetchInventory` hits the real endpoint. */
function apiApp() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  return createApp({ db });
}

describe('fetchInventory', () => {
  it('returns the ingested model from the inventory API', async () => {
    const app = apiApp();
    await app.request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: fixtureRepo, artifactDir: 'artifacts' }),
      headers: { 'content-type': 'application/json' },
    });

    const model = await fetchInventory(() => app.request('/inventory'));
    expect(model).not.toBeNull();
    expect(model!.components.map((c) => c.name)).toContain('Button');
    expect(model!.tokens.length).toBeGreaterThan(0);
    expect(Array.isArray(model!.health)).toBe(true);
  });

  it('returns null when nothing has been ingested yet (API 404)', async () => {
    const app = apiApp();
    const model = await fetchInventory(() => app.request('/inventory'));
    expect(model).toBeNull();
  });

  it('throws on an unexpected API error status', async () => {
    const boom = () => Promise.resolve(new Response('nope', { status: 500 }));
    await expect(fetchInventory(boom)).rejects.toThrow(/500/);
  });
});

describe('loadInventory', () => {
  it('folds a fetch failure into an error string with a null model', async () => {
    const { model, error } = await loadInventory(() => Promise.reject(new Error('ECONNREFUSED')));
    expect(model).toBeNull();
    expect(error).toContain('ECONNREFUSED');
  });

  it('reports a null model and no error when nothing is ingested (404)', async () => {
    const notFound = () => Promise.resolve(new Response('', { status: 404 }));
    const { model, error } = await loadInventory(notFound);
    expect(model).toBeNull();
    expect(error).toBeNull();
  });

  it('returns the model with no error on success', async () => {
    const ok = () =>
      Promise.resolve(
        new Response(JSON.stringify({ components: [], tokens: [], health: [] }), { status: 200 }),
      );
    const { model, error } = await loadInventory(ok);
    expect(error).toBeNull();
    expect(model).toEqual({ components: [], tokens: [], health: [] });
  });
});
