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

const secret = 'topsecret';
const json = { 'content-type': 'application/json' };

/** GitHub-style `sha256=<hex>` HMAC of the raw body with the configured secret. */
const sign = (body: string) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

function app(designSystem?: DesignSystemConfig) {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  return createApp({
    db,
    designSystem: designSystem ?? {
      repoPath: fixtureRepo,
      artifactDir: 'artifacts',
      webhookSecret: secret,
    },
  });
}

/** POST a signed webhook (valid signature) with a JSON body. */
function push(a: ReturnType<typeof app>, body: unknown) {
  const raw = JSON.stringify(body);
  return a.request('/webhooks/design-system', {
    method: 'POST',
    body: raw,
    headers: { ...json, 'x-hub-signature-256': sign(raw) },
  });
}

describe('design-system re-ingest webhook (#36)', () => {
  it('a signed push triggers ingestion, and the inventory reflects it afterward', async () => {
    const a = app();
    expect((await a.request('/inventory')).status).toBe(404); // nothing ingested yet

    const res = await push(a, { after: 'commit-1' });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: 'ok', commit: 'commit-1' });

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

  it('re-ingests for a new, different commit', async () => {
    const a = app();
    expect((await push(a, { after: 'commit-1' })).status).toBe(201);
    expect((await push(a, { after: 'commit-2' })).status).toBe(201);
  });

  it('accepts the commit sha from head_commit.id when `after` is absent', async () => {
    const a = app();
    expect((await push(a, { head_commit: { id: 'hc-9' } })).status).toBe(201);
  });

  it('400s a payload with no commit sha, and invalid JSON', async () => {
    const a = app();
    expect((await push(a, { nothing: true })).status).toBe(400);
    const bad = '{not json';
    const res = await a.request('/webhooks/design-system', {
      method: 'POST',
      body: bad,
      headers: { ...json, 'x-hub-signature-256': sign(bad) },
    });
    expect(res.status).toBe(400);
  });

  it('422s (generic message) when the configured repo cannot be ingested', async () => {
    const a = app({ repoPath: '/no/such/design-system', webhookSecret: secret });
    const res = await push(a, { after: 'commit-1' });
    expect(res.status).toBe(422);
    // The error must not leak the server path.
    expect(JSON.stringify(await res.json())).not.toContain('/no/such/design-system');
  });

  it('is not mounted when no design system is configured', async () => {
    const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
    runMigrations(sqlite);
    const bare = createApp({ db });
    expect((await push(bare, { after: 'x' })).status).toBe(404);
  });

  describe('HMAC signature verification (required)', () => {
    it('rejects a request with a missing or invalid signature (401)', async () => {
      const a = app();
      const raw = JSON.stringify({ after: 'commit-1' });
      // No signature header.
      const noSig = await a.request('/webhooks/design-system', {
        method: 'POST',
        body: raw,
        headers: json,
      });
      expect(noSig.status).toBe(401);
      // Wrong signature.
      const badSig = await a.request('/webhooks/design-system', {
        method: 'POST',
        body: raw,
        headers: { ...json, 'x-hub-signature-256': 'sha256=deadbeef' },
      });
      expect(badSig.status).toBe(401);
    });

    it('accepts a request with a valid signature', async () => {
      const a = app();
      expect((await push(a, { after: 'commit-1' })).status).toBe(201);
    });
  });
});
