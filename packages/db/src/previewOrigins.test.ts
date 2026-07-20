import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from './client.js';
import { runMigrations, migrationsDir } from './migrate.js';
import { createProject } from './projects.js';
import {
  addPreviewOrigin,
  listPreviewOrigins,
  removePreviewOrigin,
  isPreviewOriginAllowed,
  isValidOrigin,
  isLoopbackOrigin,
  InvalidOriginError,
} from './previewOrigins.js';

describe('isValidOrigin', () => {
  it('accepts bare origins', () => {
    for (const ok of ['http://localhost:4200', 'https://shop.example.com', 'http://127.0.0.1:3000']) {
      expect(isValidOrigin(ok), ok).toBe(true);
    }
  });

  it('rejects anything that is more than an origin', () => {
    // Each of these would be silently truncated to an origin by a naive parse — which means the
    // thing allowlisted is not the thing the author wrote. Reject instead.
    for (const bad of [
      'https://evil.com/path',
      'https://evil.com?q=1',
      'https://evil.com#frag',
      'https://user:pw@evil.com',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'not a url',
      '',
    ]) {
      expect(isValidOrigin(bad), bad).toBe(false);
    }
  });

  it('tolerates a single trailing slash, which is how browsers report an origin', () => {
    expect(isValidOrigin('https://shop.example.com/')).toBe(true);
  });
});

describe('isLoopbackOrigin', () => {
  it('identifies the local machine', () => {
    expect(isLoopbackOrigin('http://localhost:4200')).toBe(true);
    expect(isLoopbackOrigin('http://127.0.0.1:3000')).toBe(true);
    expect(isLoopbackOrigin('https://shop.example.com')).toBe(false);
    // Not loopback: an attacker-controlled host that merely mentions localhost.
    expect(isLoopbackOrigin('https://localhost.evil.com')).toBe(false);
  });
});

function freshDb() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite, migrationsDir);
  return db;
}

describe('preview origin allowlist', () => {
  let db: ReturnType<typeof freshDb>;

  beforeEach(async () => {
    db = freshDb();
    await createProject(db, { id: 'acme', name: 'Acme' });
  });

  it('starts empty and round-trips an added origin', async () => {
    expect(await listPreviewOrigins(db, 'acme')).toEqual([]);
    await addPreviewOrigin(db, 'acme', 'https://shop.example.com', 'Staging');
    const list = await listPreviewOrigins(db, 'acme');
    expect(list.map((o) => o.origin)).toEqual(['https://shop.example.com']);
    expect(list[0]!.label).toBe('Staging');
  });

  it('refuses a non-origin rather than storing something ambiguous', async () => {
    await expect(addPreviewOrigin(db, 'acme', 'https://evil.com/login')).rejects.toBeInstanceOf(
      InvalidOriginError,
    );
  });

  it('re-adding updates the label instead of duplicating', async () => {
    await addPreviewOrigin(db, 'acme', 'https://shop.example.com', 'Staging');
    await addPreviewOrigin(db, 'acme', 'https://shop.example.com', 'Production');
    const list = await listPreviewOrigins(db, 'acme');
    expect(list.length).toBe(1);
    expect(list[0]!.label).toBe('Production');
  });

  it('removes', async () => {
    await addPreviewOrigin(db, 'acme', 'https://shop.example.com');
    expect(await removePreviewOrigin(db, 'acme', 'https://shop.example.com')).toBe(true);
    expect(await removePreviewOrigin(db, 'acme', 'https://shop.example.com')).toBe(false);
    expect(await listPreviewOrigins(db, 'acme')).toEqual([]);
  });

  it('allows loopback without configuration, so the authoring loop needs no setup', async () => {
    expect(await isPreviewOriginAllowed(db, 'acme', 'http://localhost:4200')).toBe(true);
  });

  it('refuses a remote origin until it is allowlisted', async () => {
    expect(await isPreviewOriginAllowed(db, 'acme', 'https://shop.example.com')).toBe(false);
    await addPreviewOrigin(db, 'acme', 'https://shop.example.com');
    expect(await isPreviewOriginAllowed(db, 'acme', 'https://shop.example.com')).toBe(true);
  });

  it('scopes the allowlist per project', async () => {
    await createProject(db, { id: 'other', name: 'Other' });
    await addPreviewOrigin(db, 'acme', 'https://shop.example.com');
    // One project's allowlist must never grant another project's studio a frame.
    expect(await isPreviewOriginAllowed(db, 'other', 'https://shop.example.com')).toBe(false);
  });
});
