import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpecSchema } from '@lighter/spec';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SpecStore, ScreenNotFoundError, ScreenEmptyError } from './specStore.js';
import type { Spec } from '@lighter/spec';

const spec = (title: string): Spec => SpecSchema.parse({
  root: { type: 'PageShell', props: { title }, children: [] },
});

describe('SpecStore drafts (#166)', () => {
  let root: string;
  let store: SpecStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lighter-draft-'));
    store = new SpecStore(root);
    await store.init();
    await store.createScreen('Checkout');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('has no draft until one is saved', async () => {
    expect(await store.getDraft('checkout')).toBeNull();
  });

  it('round-trips a draft', async () => {
    await store.saveDraft('checkout', spec('Draft A'));
    expect(await store.getDraft('checkout')).toEqual(spec('Draft A'));
  });

  it('overwrites on repeated saves — editing must not mint anything', async () => {
    await store.saveDraft('checkout', spec('A'));
    await store.saveDraft('checkout', spec('B'));
    await store.saveDraft('checkout', spec('C'));
    expect(await store.getDraft('checkout')).toEqual(spec('C'));
    // The whole point: keystrokes don't become versions.
    expect(await store.listVersions('checkout')).toEqual([]);
  });

  it('does not confuse a draft with a version', async () => {
    await store.saveDraft('checkout', spec('Draft'));
    // `listVersions` matches /^\d+\.json$/, so draft.json must never appear as a version.
    expect(await store.listVersions('checkout')).toEqual([]);
  });

  it('promotes the draft to the next version and clears it', async () => {
    await store.saveVersion('checkout', spec('v1'));
    await store.saveDraft('checkout', spec('edited'));

    const version = await store.promoteDraft('checkout');
    expect(version).toBe(2);
    expect(await store.getVersion('checkout', 2)).toEqual(spec('edited'));
    // Cleared, so the next edit starts from the version just published.
    expect(await store.getDraft('checkout')).toBeNull();
    // v1 is untouched — versions are immutable.
    expect(await store.getVersion('checkout', 1)).toEqual(spec('v1'));
  });

  it('promotes to v1 when the screen has no versions yet', async () => {
    await store.saveDraft('checkout', spec('first'));
    expect(await store.promoteDraft('checkout')).toBe(1);
  });

  it('refuses to promote nothing rather than duplicating the latest version', async () => {
    await store.saveVersion('checkout', spec('v1'));
    await expect(store.promoteDraft('checkout')).rejects.toBeInstanceOf(ScreenEmptyError);
    expect(await store.listVersions('checkout')).toEqual([1]);
  });

  it('discards', async () => {
    await store.saveDraft('checkout', spec('oops'));
    expect(await store.discardDraft('checkout')).toBe(true);
    expect(await store.getDraft('checkout')).toBeNull();
    expect(await store.discardDraft('checkout')).toBe(false);
  });

  it('rejects an unknown screen', async () => {
    await expect(store.saveDraft('nope', spec('x'))).rejects.toBeInstanceOf(ScreenNotFoundError);
    await expect(store.promoteDraft('nope')).rejects.toBeInstanceOf(ScreenNotFoundError);
    expect(await store.getDraft('nope')).toBeNull();
  });

  it('rejects a structurally invalid draft before touching disk', async () => {
    await expect(store.saveDraft('checkout', { nope: true })).rejects.toThrow();
    expect(await store.getDraft('checkout')).toBeNull();
  });

  it('serializes concurrent saves and a promote without losing or duplicating a version', async () => {
    await store.saveVersion('checkout', spec('v1'));
    await Promise.all([
      store.saveDraft('checkout', spec('a')),
      store.saveDraft('checkout', spec('b')),
      store.saveDraft('checkout', spec('c')),
    ]);
    const version = await store.promoteDraft('checkout');
    expect(version).toBe(2);
    expect(await store.listVersions('checkout')).toEqual([1, 2]);
  });
});
