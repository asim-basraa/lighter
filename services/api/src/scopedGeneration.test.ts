import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createClient,
  runMigrations,
  createProject,
  mintToken,
  saveInventory,
  type Db,
} from '@lighter/db';
import type { LlmClient } from '@lighter/generation';
import { createApp } from './app.js';
import { ProjectStores } from './projectStores.js';

const dirs: string[] = [];

/** A fake generator that always returns the given spec JSON — no real model call. */
function fakeGenerator(output: string): LlmClient {
  return {
    async complete() {
      return output;
    },
  };
}

async function scopedApp(generator?: LlmClient) {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  const root = mkdtempSync(join(tmpdir(), 'lighter-gen-'));
  dirs.push(root);
  const app = createApp({
    db,
    storeProvider: new ProjectStores(root),
    auth: { db },
    specGenerator: generator,
  });
  return { app, db };
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const catalog = [
  {
    name: 'PageShell',
    description: '',
    slots: ['default'],
    props: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
  },
  {
    name: 'Text',
    description: '',
    slots: [],
    props: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
  },
];
const validSpec = JSON.stringify({
  root: {
    type: 'PageShell',
    props: { title: 'Home' },
    children: [{ type: 'Text', props: { content: 'Hi' }, children: [] }],
  },
});

async function project(db: Db, id: string, withCatalog = true) {
  await createProject(db, { name: id, id });
  if (withCatalog) await saveInventory(db, { components: catalog, tokens: [], health: [] }, id);
  const { token } = await mintToken(db, id);
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

const gen = (intent: string) => ({ method: 'POST', body: JSON.stringify({ intent }) });

describe('project-scoped generation (#87 scoping 2c)', () => {
  it('requires a token', async () => {
    const { app } = await scopedApp(fakeGenerator(validSpec));
    const res = await app.request('/generate', {
      ...gen('a home'),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it("generates against the caller project's catalog", async () => {
    const { app, db } = await scopedApp(fakeGenerator(validSpec));
    const a = await project(db, 'acme');
    const res = await app.request('/generate', { ...gen('a home'), headers: a });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { spec: { root: { type: string } } }).spec.root.type).toBe(
      'PageShell',
    );
  });

  it('422 when the caller project has no catalog', async () => {
    const { app, db } = await scopedApp(fakeGenerator(validSpec));
    const empty = await project(db, 'empty', false);
    const res = await app.request('/generate', { ...gen('a home'), headers: empty });
    expect(res.status).toBe(422);
  });
});
