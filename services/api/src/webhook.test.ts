import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, runMigrations } from '@lighter/db';
import { createApp } from './app.js';
import type { DesignSystemConfig } from './webhook.js';

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

function app(designSystem?: DesignSystemConfig) {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  return createApp({
    db,
    designSystem: designSystem ?? { repoPath: fixtureRepo, artifactDir: 'artifacts' },
  });
}

const push = (a: ReturnType<typeof app>, body: unknown, headers: Record<string, string> = json) =>
  a.request('/webhooks/design-system', { method: 'POST', body: JSON.stringify(body), headers });

describe('design-system re-ingest webhook (#36)', () => {
  it('a push triggers ingestion, and the inventory reflects it afterward', async () => {
    const a = app();
    // Nothing ingested yet.
    expect((await a.request('/inventory')).status).toBe(404);

    const res = await push(a, { after: 'commit-1' });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: 'ok', commit: 'commit-1' });

    // Inventory now reflects the ingested design system.
    const inv = (await (await a.request('/inventory')).json()) as { components: unknown[] };
    expect(inv.components.length).toBeGreaterThan(0);
  });

  it('is idempotent on a repeated delivery of the same commit', async () => {
    const a = app();
    expect((await push(a, { after: 'commit-1' })).status).toBe(201);
    const again = await push(a, { after: 'commit-1' });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ status: 'skipped' });
  });

  it('accepts the commit sha from head_commit.id when `after` is absent', async () => {
    const a = app();
    expect((await push(a, { head_commit: { id: 'hc-9' } })).status).toBe(201);
  });

  it('400s a payload with no commit sha, and invalid JSON', async () => {
    const a = app();
    expect((await push(a, { nothing: true })).status).toBe(400);
    const bad = await a.request('/webhooks/design-system', {
      method: 'POST',
      body: '{not json',
      headers: json,
    });
    expect(bad.status).toBe(400);
  });

  it('is not mounted when no design system is configured', async () => {
    const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
    runMigrations(sqlite);
    const bare = createApp({ db });
    expect((await push(bare, { after: 'x' })).status).toBe(404);
  });

  describe('HMAC signature verification', () => {
    const secret = 'topsecret';
    const signed = (body: string) =>
      `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

    it('rejects a request with a missing or invalid signature (401)', async () => {
      const a = app({ repoPath: fixtureRepo, artifactDir: 'artifacts', webhookSecret: secret });
      expect((await push(a, { after: 'commit-1' })).status).toBe(401); // no signature
      const badSig = await a.request('/webhooks/design-system', {
        method: 'POST',
        body: JSON.stringify({ after: 'commit-1' }),
        headers: { ...json, 'x-hub-signature-256': 'sha256=deadbeef' },
      });
      expect(badSig.status).toBe(401);
    });

    it('accepts a request with a valid signature', async () => {
      const a = app({ repoPath: fixtureRepo, artifactDir: 'artifacts', webhookSecret: secret });
      const body = JSON.stringify({ after: 'commit-1' });
      const res = await a.request('/webhooks/design-system', {
        method: 'POST',
        body,
        headers: { ...json, 'x-hub-signature-256': signed(body) },
      });
      expect(res.status).toBe(201);
    });
  });
});
