import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, runMigrations } from '@lighter/db';
import type { LlmClient } from '@lighter/generation';
import { createApp } from './app.js';

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

const validSpecJson = JSON.stringify({
  root: {
    type: 'PageShell',
    props: { title: 'Home' },
    children: [{ type: 'Text', props: { content: 'Hi', size: 'md' }, children: [] }],
  },
});

/** A fake generator that returns canned outputs in order — no real model call. */
function fakeGenerator(outputs: string[]): LlmClient {
  let i = 0;
  return {
    async complete() {
      return outputs[Math.min(i++, outputs.length - 1)]!;
    },
  };
}

async function testApp({
  generator,
  ingest = true,
}: {
  generator?: LlmClient;
  ingest?: boolean;
} = {}) {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  const app = createApp({ db, specGenerator: generator });
  if (ingest) {
    await app.request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: fixtureRepo, artifactDir: 'artifacts' }),
      headers: { 'content-type': 'application/json' },
    });
  }
  return app;
}

const post = (app: Awaited<ReturnType<typeof testApp>>, intent: unknown) =>
  app.request('/generate', {
    method: 'POST',
    body: JSON.stringify({ intent }),
    headers: { 'content-type': 'application/json' },
  });

describe('POST /generate', () => {
  it('generates a catalog-valid spec from an intent', async () => {
    const app = await testApp({ generator: fakeGenerator([validSpecJson]) });
    const res = await post(app, 'A simple home screen');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { spec: { root: { type: string } }; attempts: number };
    expect(body.spec.root.type).toBe('PageShell');
    expect(body.attempts).toBe(1);
  });

  it('retries invalid model output and returns the eventual valid spec', async () => {
    const bad = JSON.stringify({ root: { type: 'Ghost', props: {}, children: [] } });
    const app = await testApp({ generator: fakeGenerator([bad, validSpecJson]) });
    const res = await post(app, 'x');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { attempts: number }).attempts).toBe(2);
  });

  it('422s with issues when generation never validates', async () => {
    const alwaysBad = JSON.stringify({ root: { type: 'Ghost', props: {}, children: [] } });
    const app = await testApp({ generator: fakeGenerator([alwaysBad]) });
    const res = await post(app, 'x');
    expect(res.status).toBe(422);
    expect(((await res.json()) as { issues?: unknown }).issues).toBeDefined();
  });

  it('400s a missing intent', async () => {
    const app = await testApp({ generator: fakeGenerator([validSpecJson]) });
    expect((await post(app, '')).status).toBe(400);
  });

  it('422s when no catalog has been ingested', async () => {
    const app = await testApp({ generator: fakeGenerator([validSpecJson]), ingest: false });
    expect((await post(app, 'x')).status).toBe(422);
  });

  it('501s when generation is not configured', async () => {
    const app = await testApp(); // no generator
    expect((await post(app, 'x')).status).toBe(501);
  });

  it('502s (without leaking the error) when the LLM call throws', async () => {
    const throwing: LlmClient = {
      async complete() {
        throw new Error('secret upstream 401 detail');
      },
    };
    const app = await testApp({ generator: throwing });
    const res = await post(app, 'x');
    expect(res.status).toBe(502);
    const body = (await res.json()) as { message: string };
    expect(body.message).not.toMatch(/secret|401/);
  });
});
