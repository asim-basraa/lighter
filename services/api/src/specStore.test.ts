import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SpecStore, slugify, ScreenExistsError, ScreenNotFoundError } from './specStore.js';
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
});
