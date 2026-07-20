import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpecSchema } from '@lighter/spec';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { registerScreenRoutes } from './screens.js';
import { SpecStore } from './specStore.js';

const spec = (title: string) =>
  SpecSchema.parse({ root: { type: 'PageShell', props: { title }, children: [] } });

/** A catalog that knows PageShell (with a required title) and nothing else. */
const catalog = {
  PageShell: {
    props: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
      additionalProperties: false,
    },
  },
};

describe('screen draft routes (#166)', () => {
  let root: string;
  let store: SpecStore;
  let app: Hono;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lighter-draft-api-'));
    store = new SpecStore(root);
    await store.init();
    await store.createScreen('Checkout');
    app = new Hono();
    registerScreenRoutes(
      app,
      async () => store,
      async () => catalog,
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const put = (body: unknown) =>
    app.request('/screens/checkout/draft', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('404s when there is no draft yet', async () => {
    expect((await app.request('/screens/checkout/draft')).status).toBe(404);
  });

  it('saves and reads a draft', async () => {
    expect((await put({ spec: spec('Draft') })).status).toBe(200);
    const res = await app.request('/screens/checkout/draft');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { spec: unknown }).spec).toEqual(spec('Draft'));
  });

  it('accepts a draft the CATALOG would reject, because editing passes through invalid states', async () => {
    // A half-built tree is normal while editing. Refusing it here would make the editor unusable —
    // the check belongs on promote, which is the publishing act.
    const res = await put({ spec: { root: { type: 'NotACatalogComponent', props: {}, children: [] } } });
    expect(res.status).toBe(200);
  });

  it('still rejects a structurally invalid spec', async () => {
    expect((await put({ spec: { nope: true } })).status).toBe(400);
  });

  it('promotes to a new version and clears the draft', async () => {
    await put({ spec: spec('v1 content') });
    const promote = await app.request('/screens/checkout/draft/promote', { method: 'POST' });
    expect(promote.status).toBe(201);
    expect(await promote.json()).toEqual({ version: 1 });
    // Draft is gone, so the next edit starts from what was just published.
    expect((await app.request('/screens/checkout/draft')).status).toBe(404);
    expect(await store.getVersion('checkout', 1)).toEqual(spec('v1 content'));
  });

  it('refuses to promote a draft that fails catalog validation', async () => {
    await put({ spec: { root: { type: 'NotACatalogComponent', props: {}, children: [] } } });
    const res = await app.request('/screens/checkout/draft/promote', { method: 'POST' });
    expect(res.status).toBe(400);
    // Nothing published, and the draft survives so the author can fix it.
    expect(await store.listVersions('checkout')).toEqual([]);
    expect((await app.request('/screens/checkout/draft')).status).toBe(200);
  });

  it('404s promoting with no draft', async () => {
    expect((await app.request('/screens/checkout/draft/promote', { method: 'POST' })).status).toBe(404);
  });

  it('discards', async () => {
    await put({ spec: spec('oops') });
    expect((await app.request('/screens/checkout/draft', { method: 'DELETE' })).status).toBe(200);
    expect((await app.request('/screens/checkout/draft', { method: 'DELETE' })).status).toBe(404);
  });

  it('404s for an unknown screen', async () => {
    expect((await app.request('/screens/nope/draft')).status).toBe(404);
    const res = await app.request('/screens/nope/draft', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spec: spec('x') }),
    });
    expect(res.status).toBe(404);
  });

  it('leaves earlier versions untouched when promoting', async () => {
    await store.saveVersion('checkout', spec('original'));
    await put({ spec: spec('edited') });
    const res = await app.request('/screens/checkout/draft/promote', { method: 'POST' });
    expect(await res.json()).toEqual({ version: 2 });
    expect(await store.getVersion('checkout', 1)).toEqual(spec('original'));
    expect(await store.getVersion('checkout', 2)).toEqual(spec('edited'));
  });
});
