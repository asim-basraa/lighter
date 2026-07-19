import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  createClient,
  runMigrations,
  createProject,
  mintToken,
  upsertUser,
  addMember,
  type Db,
} from '@lighter/db';
import { requireProject, requireUser, requireOwner, type AuthConfig } from './auth.js';
import type { JwtVerifier } from './jwt.js';

// A fake verifier: two known JWTs map to two users; anything else throws (invalid).
const verifier: JwtVerifier = {
  async verify(token) {
    if (token === 'jwt-owner') return { userId: 'u-owner', email: 'owner@x.com' };
    if (token === 'jwt-member') return { userId: 'u-member', email: 'member@x.com' };
    throw new Error('bad jwt');
  },
};

let db: Db;
let apiToken: string;

beforeEach(async () => {
  const client = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(client.sqlite);
  db = client.db;
  await createProject(db, { name: 'Acme', id: 'acme' });
  apiToken = (await mintToken(db, 'acme', { label: 'ci' })).token;
  await upsertUser(db, { id: 'u-owner', email: 'owner@x.com' });
  await upsertUser(db, { id: 'u-member', email: 'member@x.com' });
  await addMember(db, 'acme', 'u-owner', 'owner');
  await addMember(db, 'acme', 'u-member', 'member');
});

function appWith(config: AuthConfig) {
  const app = new Hono();
  app.get('/scoped', requireProject(config), (c) =>
    c.json({ project: c.get('project').id, role: c.get('member')?.role ?? null }),
  );
  app.get('/me', requireUser(config), (c) => c.json({ user: c.get('user')!.id }));
  app.get('/owner-only', requireProject(config), requireOwner(), (c) => c.json({ ok: true }));
  return app;
}

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('requireProject — machine lane (project API token)', () => {
  it('accepts a valid project token and resolves the project', async () => {
    const res = await appWith({ db, jwtVerifier: verifier }).request('/scoped', {
      headers: auth(apiToken),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ project: 'acme', role: null });
  });

  it('401s with no credential', async () => {
    const res = await appWith({ db, jwtVerifier: verifier }).request('/scoped');
    expect(res.status).toBe(401);
  });

  it('401s an unknown credential', async () => {
    const res = await appWith({ db, jwtVerifier: verifier }).request('/scoped', {
      headers: auth('nonsense'),
    });
    expect(res.status).toBe(401);
  });

  it('still works token-only when no JWT verifier is configured', async () => {
    const res = await appWith({ db }).request('/scoped', { headers: auth(apiToken) });
    expect(res.status).toBe(200);
  });
});

describe('requireProject — human lane (Supabase JWT + X-Lighter-Project)', () => {
  it('accepts a JWT + project header for a member, attaching the role', async () => {
    const res = await appWith({ db, jwtVerifier: verifier }).request('/scoped', {
      headers: { ...auth('jwt-owner'), 'x-lighter-project': 'acme' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ project: 'acme', role: 'owner' });
  });

  it('400s a JWT with no project header', async () => {
    const res = await appWith({ db, jwtVerifier: verifier }).request('/scoped', {
      headers: auth('jwt-owner'),
    });
    expect(res.status).toBe(400);
  });

  it('403s a valid user who is not a member of the requested project', async () => {
    await createProject(db, { name: 'Other', id: 'other' });
    const res = await appWith({ db, jwtVerifier: verifier }).request('/scoped', {
      headers: { ...auth('jwt-owner'), 'x-lighter-project': 'other' },
    });
    expect(res.status).toBe(403);
  });
});

describe('requireUser — JWT-only lane', () => {
  it('accepts a valid JWT and attaches the user', async () => {
    const res = await appWith({ db, jwtVerifier: verifier }).request('/me', {
      headers: auth('jwt-member'),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: 'u-member' });
  });

  it('rejects a project API token (humans only)', async () => {
    const res = await appWith({ db, jwtVerifier: verifier }).request('/me', {
      headers: auth(apiToken),
    });
    expect(res.status).toBe(401);
  });
});

describe('requireOwner', () => {
  it('allows an owner', async () => {
    const res = await appWith({ db, jwtVerifier: verifier }).request('/owner-only', {
      headers: { ...auth('jwt-owner'), 'x-lighter-project': 'acme' },
    });
    expect(res.status).toBe(200);
  });

  it('forbids a non-owner member', async () => {
    const res = await appWith({ db, jwtVerifier: verifier }).request('/owner-only', {
      headers: { ...auth('jwt-member'), 'x-lighter-project': 'acme' },
    });
    expect(res.status).toBe(403);
  });
});
