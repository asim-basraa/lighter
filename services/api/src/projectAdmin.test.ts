import { describe, it, expect, beforeEach } from 'vitest';
import { createClient, runMigrations, type Db } from '@lighter/db';
import { createApp } from './app.js';
import type { JwtVerifier } from './jwt.js';

// Fake verifier: a token `u:<sub>:<email>` authenticates that user. Lets tests drive the human lane.
const verifier: JwtVerifier = {
  async verify(token) {
    const m = /^u:([^:]+):(.+)$/.exec(token);
    if (!m) throw new Error('bad jwt');
    return { userId: m[1]!, email: m[2]! };
  },
};

let db: Db;
function makeApp() {
  const app = createApp({ db, auth: { db, jwtVerifier: verifier } });
  return app;
}
const jwt = (sub: string, email: string) => ({ authorization: `Bearer u:${sub}:${email}` });

beforeEach(() => {
  const client = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(client.sqlite);
  db = client.db;
});

describe('POST/GET /projects (create + list mine)', () => {
  it('creates a project with the caller as owner and lists it', async () => {
    const app = makeApp();
    const created = await app.request('/projects', {
      method: 'POST',
      headers: { ...jwt('alice', 'alice@x.com'), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Acme Store' }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ id: 'acme-store', name: 'Acme Store', role: 'owner' });

    const list = await app.request('/projects', { headers: jwt('alice', 'alice@x.com') });
    expect(await list.json()).toEqual([
      expect.objectContaining({ id: 'acme-store', role: 'owner' }),
    ]);
  });

  it('rejects a blank name (400) and a duplicate (409)', async () => {
    const app = makeApp();
    const blank = await app.request('/projects', {
      method: 'POST',
      headers: { ...jwt('alice', 'a@x.com'), 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  ' }),
    });
    expect(blank.status).toBe(400);
    const mk = () =>
      app.request('/projects', {
        method: 'POST',
        headers: { ...jwt('alice', 'a@x.com'), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Dup' }),
      });
    expect((await mk()).status).toBe(201);
    expect((await mk()).status).toBe(409);
  });

  it('rejects a machine token / no auth on the human lane (401)', async () => {
    const app = makeApp();
    const res = await app.request('/projects', {
      method: 'POST',
      headers: { authorization: 'Bearer lgt_bogus', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('members + invites', () => {
  async function seedProject(app: ReturnType<typeof makeApp>) {
    await app.request('/projects', {
      method: 'POST',
      headers: { ...jwt('owner', 'owner@x.com'), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Team' }),
    });
  }

  it('invites a not-yet-registered email, then materializes it on their first login', async () => {
    const app = makeApp();
    await seedProject(app);
    const invite = await app.request('/projects/team/members', {
      method: 'POST',
      headers: { ...jwt('owner', 'owner@x.com'), 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'Bob@x.com', role: 'member' }),
    });
    expect(invite.status).toBe(201);
    expect(await invite.json()).toMatchObject({ status: 'invited', email: 'bob@x.com' });

    // Before Bob logs in: he's a pending invite, not a member.
    const before = await app.request('/projects/team/members', {
      headers: jwt('owner', 'owner@x.com'),
    });
    const beforeBody = (await before.json()) as { members: unknown[]; invites: unknown[] };
    expect(beforeBody.members).toHaveLength(1);
    expect(beforeBody.invites).toHaveLength(1);

    // Bob logs in (hits any authed route) → invite materializes → he now sees the project.
    const bobProjects = await app.request('/projects', { headers: jwt('bob', 'bob@x.com') });
    expect(await bobProjects.json()).toEqual([
      expect.objectContaining({ id: 'team', role: 'member' }),
    ]);
  });

  it('forbids a non-owner from inviting (403)', async () => {
    const app = makeApp();
    await seedProject(app);
    // Add carol as a plain member via invite + login.
    await app.request('/projects/team/members', {
      method: 'POST',
      headers: { ...jwt('owner', 'owner@x.com'), 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'carol@x.com' }),
    });
    await app.request('/projects', { headers: jwt('carol', 'carol@x.com') }); // materialize
    const res = await app.request('/projects/team/members', {
      method: 'POST',
      headers: { ...jwt('carol', 'carol@x.com'), 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'dave@x.com' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('project tokens (mint / list / revoke / use)', () => {
  async function ownerProject(app: ReturnType<typeof makeApp>) {
    await app.request('/projects', {
      method: 'POST',
      headers: { ...jwt('owner', 'owner@x.com'), 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Shop' }),
    });
  }

  it('mints a token an owner can then use on the machine lane, and can revoke', async () => {
    const app = makeApp();
    await ownerProject(app);

    const minted = await app.request('/projects/shop/tokens', {
      method: 'POST',
      headers: { ...jwt('owner', 'owner@x.com'), 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'ci' }),
    });
    expect(minted.status).toBe(201);
    const { token } = (await minted.json()) as { token: string };
    expect(token).toMatch(/^lgt_/);

    // The minted token works on the machine lane.
    const me = await app.request('/projects/me', { headers: { authorization: `Bearer ${token}` } });
    expect(await me.json()).toEqual({ id: 'shop', name: 'Shop' });

    // List shows metadata (never the raw token).
    const list = await app.request('/projects/shop/tokens', {
      headers: jwt('owner', 'owner@x.com'),
    });
    const tokens = (await list.json()) as { id: string; label: string }[];
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ label: 'ci' });
    expect(JSON.stringify(tokens)).not.toContain(token);

    // Revoke by id → the token stops working.
    const del = await app.request(`/projects/shop/tokens/${tokens[0]!.id}`, {
      method: 'DELETE',
      headers: jwt('owner', 'owner@x.com'),
    });
    expect(del.status).toBe(200);
    const after = await app.request('/projects/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(after.status).toBe(401);
  });

  it('forbids a non-member from minting (403)', async () => {
    const app = makeApp();
    await ownerProject(app);
    const res = await app.request('/projects/shop/tokens', {
      method: 'POST',
      headers: { ...jwt('stranger', 'stranger@x.com'), 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });
});
