import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, runMigrations } from '@lighter/db';
import type { LlmClient } from '@lighter/generation';
import { createApp } from './app.js';
import { SpecStore } from './specStore.js';

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

const v1Spec = {
  root: {
    type: 'PageShell',
    props: { title: 'Home' },
    children: [{ type: 'Text', props: { content: 'Old', size: 'md' }, children: [] }],
  },
};
const refinedJson = JSON.stringify({
  root: {
    type: 'PageShell',
    props: { title: 'Home' },
    children: [{ type: 'Text', props: { content: 'New', size: 'lg' }, children: [] }],
  },
});

function fakeGenerator(outputs: string[]): LlmClient {
  let i = 0;
  return {
    async complete() {
      return outputs[Math.min(i++, outputs.length - 1)]!;
    },
  };
}

let root: string;

async function testApp({
  generator,
  withStore = true,
  ingest = true,
}: {
  generator?: LlmClient;
  withStore?: boolean;
  ingest?: boolean;
} = {}) {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  let specStore: SpecStore | undefined;
  if (withStore) {
    root = mkdtempSync(join(tmpdir(), 'lighter-refine-'));
    specStore = new SpecStore(root);
    await specStore.init();
  }
  const app = createApp({ db, specStore, specGenerator: generator });
  if (ingest) {
    await app.request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ repoPath: fixtureRepo, artifactDir: 'artifacts' }),
      headers: { 'content-type': 'application/json' },
    });
  }
  return app;
}

/** A generator that records the prompts it received (to assert what context it was given). */
function recordingGenerator(output: string): LlmClient & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    prompts,
    async complete(_system, user) {
      prompts.push(user);
      return output;
    },
  };
}

const json = { 'content-type': 'application/json' };

/** Create a screen with one saved spec version. */
async function seedScreen(app: Awaited<ReturnType<typeof testApp>>) {
  await app.request('/screens', {
    method: 'POST',
    body: JSON.stringify({ name: 'Home' }),
    headers: json,
  });
  await app.request('/screens/home/versions', {
    method: 'POST',
    body: JSON.stringify({ spec: v1Spec }),
    headers: json,
  });
}

const refine = (app: Awaited<ReturnType<typeof testApp>>, id: string, instruction: unknown) =>
  app.request(`/screens/${id}/refine`, {
    method: 'POST',
    body: JSON.stringify({ instruction }),
    headers: json,
  });

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('POST /screens/:id/refine (#19)', () => {
  it('refines the latest spec and saves it as a new version', async () => {
    const app = await testApp({ generator: fakeGenerator([refinedJson]) });
    await seedScreen(app);

    const res = await refine(app, 'home', 'Make the text larger');
    expect(res.status).toBe(201);
    const body = (await res.json()) as { version: number; spec: { root: unknown } };
    expect(body.version).toBe(2);

    // The new version is the refined spec; the original v1 is unchanged.
    const meta = await (await app.request('/screens/home')).json();
    expect(meta).toMatchObject({ versions: [1, 2] });
    const v2 = await (await app.request('/screens/home/versions/2')).json();
    expect((v2 as { spec: typeof refinedJson }).spec).toEqual(JSON.parse(refinedJson));
  });

  it('422s when the refinement never validates', async () => {
    const bad = JSON.stringify({ root: { type: 'Ghost', props: {}, children: [] } });
    const app = await testApp({ generator: fakeGenerator([bad]) });
    await seedScreen(app);
    const res = await refine(app, 'home', 'x');
    expect(res.status).toBe(422);
    // Nothing new was saved.
    expect(await (await app.request('/screens/home')).json()).toMatchObject({ versions: [1] });
  });

  it('404s an unknown screen, 422s a screen with no version', async () => {
    const app = await testApp({ generator: fakeGenerator([refinedJson]) });
    expect((await refine(app, 'nope', 'x')).status).toBe(404);
    await app.request('/screens', {
      method: 'POST',
      body: JSON.stringify({ name: 'Empty' }),
      headers: json,
    });
    expect((await refine(app, 'empty', 'x')).status).toBe(422);
  });

  it('400s a missing instruction', async () => {
    const app = await testApp({ generator: fakeGenerator([refinedJson]) });
    await seedScreen(app);
    expect((await refine(app, 'home', '')).status).toBe(400);
  });

  it('refines the LATEST version, saving as the next one', async () => {
    const gen = recordingGenerator(refinedJson);
    const app = await testApp({ generator: gen });
    await seedScreen(app); // v1 has content "Old"
    // Save a v2 with distinct content.
    const v2Spec = {
      root: {
        type: 'PageShell',
        props: { title: 'Home' },
        children: [{ type: 'Text', props: { content: 'V2-content', size: 'md' }, children: [] }],
      },
    };
    await app.request('/screens/home/versions', {
      method: 'POST',
      body: JSON.stringify({ spec: v2Spec }),
      headers: json,
    });

    const res = await refine(app, 'home', 'tweak it');
    expect(res.status).toBe(201);
    expect(((await res.json()) as { version: number }).version).toBe(3);
    // The refine used v2 (the latest) as context, not v1.
    expect(gen.prompts[0]).toContain('V2-content');
    expect(gen.prompts[0]).not.toContain('"Old"');
  });

  it('501s when the store is not configured', async () => {
    const noStore = await testApp({ generator: fakeGenerator([refinedJson]), withStore: false });
    expect((await refine(noStore, 'home', 'x')).status).toBe(501);
  });

  it('501s when generation is not configured', async () => {
    const noGen = await testApp(); // store but no generator
    expect((await refine(noGen, 'home', 'x')).status).toBe(501);
  });
});
