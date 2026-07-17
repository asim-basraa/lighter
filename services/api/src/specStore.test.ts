import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SpecStore,
  slugify,
  ScreenExistsError,
  ScreenNotFoundError,
  ScreenEmptyError,
} from './specStore.js';
import type { Spec } from '@lighter/spec';

const spec: Spec = {
  root: { type: 'PageShell', props: { title: 'Home' }, children: [] },
};

function gitLog(root: string): string[] {
  return execFileSync('git', ['log', '--pretty=%s'], { cwd: root, encoding: 'utf8' })
    .trim()
    .split('\n');
}

describe('slugify', () => {
  it('produces filesystem-safe ids', () => {
    expect(slugify('Checkout Flow')).toBe('checkout-flow');
    expect(slugify('  Weird__Name!! ')).toBe('weird-name');
  });
});

describe('SpecStore', () => {
  let root: string;
  let store: SpecStore;

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'lighter-specs-'));
    store = new SpecStore(root);
    await store.init();
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('creates a screen as a committed screen.json', async () => {
    const meta = await store.createScreen('Checkout');
    expect(meta).toEqual({ id: 'checkout', name: 'Checkout' });
    expect(existsSync(join(root, 'checkout', 'screen.json'))).toBe(true);
    expect(gitLog(root)).toContain('Create screen checkout');
  });

  it('rejects creating a screen that already exists', async () => {
    await store.createScreen('Checkout');
    await expect(store.createScreen('Checkout')).rejects.toBeInstanceOf(ScreenExistsError);
  });

  it('rejects a name with no alphanumeric characters', async () => {
    await expect(store.createScreen('!!!')).rejects.toThrow(/alphanumeric/);
  });

  it('saves spec versions as sequential immutable files, each committed', async () => {
    await store.createScreen('Checkout');
    expect(await store.saveVersion('checkout', spec)).toBe(1);
    expect(await store.saveVersion('checkout', spec)).toBe(2);
    expect(existsSync(join(root, 'checkout', '1.json'))).toBe(true);
    expect(existsSync(join(root, 'checkout', '2.json'))).toBe(true);
    expect(gitLog(root)).toEqual(
      expect.arrayContaining(['Screen checkout v1', 'Screen checkout v2']),
    );
  });

  it('lists versions ascending and fetches a specific version', async () => {
    await store.createScreen('Checkout');
    await store.saveVersion('checkout', spec);
    await store.saveVersion('checkout', spec);
    expect(await store.listVersions('checkout')).toEqual([1, 2]);
    expect(await store.getVersion('checkout', 2)).toEqual(spec);
  });

  it('returns null for a missing screen or version', async () => {
    expect(await store.getScreen('nope')).toBeNull();
    expect(await store.getVersion('nope', 1)).toBeNull();
    await store.createScreen('Checkout');
    expect(await store.getVersion('checkout', 99)).toBeNull();
  });

  it('rejects saving a version to a screen that does not exist', async () => {
    await expect(store.saveVersion('nope', spec)).rejects.toBeInstanceOf(ScreenNotFoundError);
  });

  it('rejects a structurally invalid spec', async () => {
    await store.createScreen('Checkout');
    await expect(store.saveVersion('checkout', { root: { props: {} } })).rejects.toThrow();
  });

  it('lists screens sorted by id', async () => {
    await store.createScreen('Settings');
    await store.createScreen('Checkout');
    expect((await store.listScreens()).map((s) => s.id)).toEqual(['checkout', 'settings']);
  });

  it('refuses a traversal id — no read or write escapes the root', async () => {
    const escapes = ['../evil', '../../etc', '.git', 'a/b', 'UPPER'];
    for (const bad of escapes) {
      expect(await store.getScreen(bad)).toBeNull();
      expect(await store.getVersion(bad, 1)).toBeNull();
      expect(await store.listVersions(bad)).toEqual([]);
      await expect(store.saveVersion(bad, spec)).rejects.toBeInstanceOf(ScreenNotFoundError);
    }
    // Nothing was written outside the store root.
    expect(existsSync(join(root, '..', '1.json'))).toBe(false);
  });

  it('numbers concurrent saves without collision or lost writes', async () => {
    await store.createScreen('Checkout');
    const results = await Promise.all(
      Array.from({ length: 8 }, () => store.saveVersion('checkout', spec)),
    );
    // Every save got a distinct version and the files are 1..8 contiguous.
    expect([...results].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(await store.listVersions('checkout')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('duplicates a screen: new v1 copies the source latest, source untouched', async () => {
    await store.createScreen('Checkout');
    await store.saveVersion('checkout', spec);
    const v2: Spec = { root: { type: 'Text', props: { content: 'v2' }, children: [] } };
    await store.saveVersion('checkout', v2);

    const dup = await store.duplicateScreen('checkout', 'Checkout Copy');
    expect(dup).toEqual({ screen: { id: 'checkout-copy', name: 'Checkout Copy' }, version: 1 });
    // New screen's v1 is the source's LATEST (v2).
    expect(await store.getVersion('checkout-copy', 1)).toEqual(v2);
    // Source is unchanged: still two versions with the same contents.
    expect(await store.listVersions('checkout')).toEqual([1, 2]);
    expect(await store.getVersion('checkout', 2)).toEqual(v2);
  });

  it('produces an independent copy — editing the duplicate does not touch the source', async () => {
    await store.createScreen('Checkout');
    await store.saveVersion('checkout', spec);
    await store.duplicateScreen('checkout', 'Copy');
    await store.saveVersion('copy', spec); // copy now has v1 + v2
    expect(await store.listVersions('copy')).toEqual([1, 2]);
    expect(await store.listVersions('checkout')).toEqual([1]); // source unaffected
  });

  it('refuses to duplicate a missing or spec-less source, or onto an existing name', async () => {
    await expect(store.duplicateScreen('nope', 'X')).rejects.toBeInstanceOf(ScreenNotFoundError);

    await store.createScreen('Empty');
    await expect(store.duplicateScreen('empty', 'X')).rejects.toBeInstanceOf(ScreenEmptyError);

    await store.createScreen('Checkout');
    await store.saveVersion('checkout', spec);
    await store.createScreen('Taken');
    await expect(store.duplicateScreen('checkout', 'Taken')).rejects.toBeInstanceOf(
      ScreenExistsError,
    );
  });

  it('skips a corrupt screen.json instead of failing the whole listing', async () => {
    await store.createScreen('Checkout');
    mkdirSync(join(root, 'broken'));
    writeFileSync(join(root, 'broken', 'screen.json'), 'not json');
    // getScreen tolerates the bad dir; listScreens still returns the good one.
    expect(await store.getScreen('broken')).toBeNull();
    expect((await store.listScreens()).map((s) => s.id)).toEqual(['checkout']);
  });
});
