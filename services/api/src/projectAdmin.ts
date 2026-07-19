import type { Hono, Context } from 'hono';
import {
  createProject,
  listProjectsForUser,
  getMembership,
  addMember,
  listMembers,
  createInvite,
  listInvites,
  getUserByEmail,
  mintToken,
  listTokens,
  revokeTokenById,
  type Role,
} from '@lighter/db';
import { requireUser, type AuthConfig } from './auth.js';

/** Roles a member/invite can have. */
const ROLES: Role[] = ['owner', 'member'];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The project/team-management surface (#91) — the human (studio) lane, gated by `requireUser`.
 * Machine tokens can't reach these: creating projects, inviting members, and minting/revoking tokens
 * are owner/human actions. Mounted only when Supabase Auth is configured (a JWT verifier exists).
 */
export function registerProjectAdminRoutes(app: Hono, config: AuthConfig): void {
  const guard = requireUser(config);

  // Load the caller's membership for a path project, or send the right error. Returns null on failure
  // (response already sent). `needOwner` additionally requires the owner role.
  async function requireMember(
    c: Context,
    projectId: string,
    needOwner = false,
  ): Promise<Role | null> {
    const user = c.get('user')!;
    const member = await getMembership(config.db, projectId, user.id);
    if (!member) {
      c.status(403);
      c.res = c.json({ status: 'error', message: 'not a member of this project' });
      return null;
    }
    if (needOwner && member.role !== 'owner') {
      c.status(403);
      c.res = c.json({ status: 'error', message: 'owner role required' });
      return null;
    }
    return member.role;
  }

  // Create a project; the creator becomes its owner.
  app.post('/projects', guard, async (c) => {
    const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ status: 'error', message: 'name is required' }, 400);
    const id = slugify(name);
    if (!id) return c.json({ status: 'error', message: 'name has no usable characters' }, 400);
    try {
      const project = await createProject(config.db, { name, id });
      await addMember(config.db, project.id, c.get('user')!.id, 'owner');
      return c.json({ id: project.id, name: project.name, role: 'owner' }, 201);
    } catch {
      // Unique PK violation → the slug is taken.
      return c.json({ status: 'error', message: 'a project with that name already exists' }, 409);
    }
  });

  // List the projects the caller belongs to, with their role in each.
  app.get('/projects', guard, async (c) => {
    const projects = await listProjectsForUser(config.db, c.get('user')!.id);
    return c.json(projects);
  });

  // The members + pending invites of a project (any member).
  app.get('/projects/:id/members', guard, async (c) => {
    const projectId = c.req.param('id');
    if (!(await requireMember(c, projectId))) return c.res;
    const [members, invites] = await Promise.all([
      listMembers(config.db, projectId),
      listInvites(config.db, projectId),
    ]);
    return c.json({ members, invites });
  });

  // Invite a member by email (owner only). If the invitee already has an account they're added
  // immediately; otherwise a pending invite is stored and materialized on their first login.
  app.post('/projects/:id/members', guard, async (c) => {
    const projectId = c.req.param('id');
    if (!(await requireMember(c, projectId, true))) return c.res;
    const body = (await c.req.json().catch(() => null)) as {
      email?: unknown;
      role?: unknown;
    } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) {
      return c.json({ status: 'error', message: 'a valid email is required' }, 400);
    }
    const role: Role = body?.role === 'owner' ? 'owner' : 'member';
    if (body?.role !== undefined && !ROLES.includes(body.role as Role)) {
      return c.json({ status: 'error', message: 'role must be owner or member' }, 400);
    }
    const existing = await getUserByEmail(config.db, email);
    if (existing) {
      await addMember(config.db, projectId, existing.id, role);
      return c.json({ status: 'added', email, role }, 201);
    }
    await createInvite(config.db, projectId, email, role);
    return c.json({ status: 'invited', email, role }, 201);
  });

  // Mint a machine API token for the project (owner only). The raw token is returned ONCE.
  app.post('/projects/:id/tokens', guard, async (c) => {
    const projectId = c.req.param('id');
    if (!(await requireMember(c, projectId, true))) return c.res;
    const body = (await c.req.json().catch(() => null)) as { label?: unknown } | null;
    const label =
      typeof body?.label === 'string' && body.label.trim() ? body.label.trim() : undefined;
    const minted = await mintToken(config.db, projectId, { label, secret: config.tokenSecret });
    return c.json({ token: minted.token, label: minted.label }, 201);
  });

  // List the project's tokens (metadata only — never the raw token) (owner only).
  app.get('/projects/:id/tokens', guard, async (c) => {
    const projectId = c.req.param('id');
    if (!(await requireMember(c, projectId, true))) return c.res;
    return c.json(await listTokens(config.db, projectId));
  });

  // Revoke a token by its id (owner only).
  app.delete('/projects/:id/tokens/:tokenId', guard, async (c) => {
    const projectId = c.req.param('id');
    if (!(await requireMember(c, projectId, true))) return c.res;
    const revoked = await revokeTokenById(config.db, projectId, c.req.param('tokenId'));
    if (!revoked) return c.json({ status: 'error', message: 'token not found' }, 404);
    return c.json({ status: 'revoked' });
  });
}
