import type { MiddlewareHandler } from 'hono';
import {
  resolveProjectByToken,
  getProject,
  getMembership,
  syncUserOnLogin,
  type Db,
  type Project,
  type Membership,
} from '@lighter/db';
import type { JwtVerifier } from './jwt.js';

/** The authenticated human on a request (studio / Supabase-Auth lane). */
export interface AuthUser {
  id: string;
  email: string | null;
}

// Make the resolved identity available to downstream handlers as typed context variables.
declare module 'hono' {
  interface ContextVariableMap {
    project: Project;
    /** Set on the human lane (Supabase JWT); absent on the machine lane (project token). */
    user?: AuthUser;
    /** The user's membership in `project`; set only on the human lane. */
    member?: Membership;
  }
}

/**
 * Config for the auth middleware (#87, #91). Wired from the service env at `createApp`. `jwtVerifier`
 * is null/undefined when Supabase Auth is not configured, so only project API tokens work (the pre-#91
 * behavior, byte-identical for the CLI lane and every existing test).
 */
export interface AuthConfig {
  db: Db;
  /** HMAC secret for project-token hashing (from `LIGHTER_TOKEN_SIGNING_SECRET`); undefined → dev default. */
  tokenSecret?: string;
  /** Supabase JWT verifier for the human/studio lane; null when Supabase Auth is off. */
  jwtVerifier?: JwtVerifier | null;
}

/** Header carrying the project a Supabase-authenticated (multi-project) user is acting within. */
const PROJECT_HEADER = 'x-lighter-project';

/** Extract a bearer token from an Authorization header, or undefined. */
function bearerToken(header: string | undefined): string | undefined {
  if (!header || !/^Bearer\s+/i.test(header)) return undefined;
  return header.replace(/^Bearer\s+/i, '').trim() || undefined;
}

/**
 * Verify a Supabase JWT, or return null on any failure (never throws — the caller decides the status).
 * On success the user's local mirror is upserted so their email stays current.
 */
async function resolveUser(config: AuthConfig, token: string): Promise<AuthUser | null> {
  if (!config.jwtVerifier) return null;
  try {
    const claims = await config.jwtVerifier.verify(token);
    // Upsert the user and materialize any pending invites addressed to their email.
    await syncUserOnLogin(config.db, { id: claims.userId, email: claims.email });
    return { id: claims.userId, email: claims.email };
  } catch {
    return null;
  }
}

/**
 * Require an authenticated human (Supabase JWT). Attaches `user`. Used by the project/team-management
 * surface (create/list projects, invite members, mint tokens) — actions a machine token can't take.
 * 401 without a valid JWT; a project API token is NOT accepted here.
 */
export function requireUser(config: AuthConfig): MiddlewareHandler {
  return async (c, next) => {
    const token = bearerToken(c.req.header('authorization'));
    if (!token) return c.json({ status: 'error', message: 'missing bearer token' }, 401);
    const user = await resolveUser(config, token);
    if (!user) return c.json({ status: 'error', message: 'invalid token' }, 401);
    c.set('user', user);
    await next();
  };
}

/**
 * Require access to a project, via EITHER lane:
 *   - a **project API token** (CLI / GitHub Action) → the project is implied by the token; or
 *   - a **Supabase JWT** + an `X-Lighter-Project` header → the user must be a member of that project.
 *
 * On success `project` is attached (and, on the human lane, `user` + `member`). A missing/unknown
 * credential is refused 401 without revealing whether it existed. This keeps the machine lane
 * byte-identical to pre-#91 while adding the studio lane.
 */
export function requireProject(config: AuthConfig): MiddlewareHandler {
  return async (c, next) => {
    const token = bearerToken(c.req.header('authorization'));
    if (!token) return c.json({ status: 'error', message: 'missing bearer token' }, 401);

    // Machine lane first: a project API token resolves directly to its project.
    const byToken = await resolveProjectByToken(config.db, token, config.tokenSecret);
    if (byToken) {
      c.set('project', byToken);
      await next();
      return;
    }

    // Human lane: a Supabase JWT + the project the user is acting within.
    const user = await resolveUser(config, token);
    if (user) {
      const projectId = c.req.header(PROJECT_HEADER);
      if (!projectId) {
        return c.json({ status: 'error', message: `${PROJECT_HEADER} header is required` }, 400);
      }
      const member = await getMembership(config.db, projectId, user.id);
      if (!member) {
        return c.json({ status: 'error', message: 'not a member of this project' }, 403);
      }
      const project = await getProject(config.db, projectId);
      if (!project) return c.json({ status: 'error', message: 'project not found' }, 404);
      c.set('project', project);
      c.set('user', user);
      c.set('member', member);
      await next();
      return;
    }

    return c.json({ status: 'error', message: 'invalid token' }, 401);
  };
}

/** Guard for owner-only actions on the human lane. Assumes `requireProject`/membership already ran. */
export function requireOwner(): MiddlewareHandler {
  return async (c, next) => {
    const member = c.get('member');
    if (!member || member.role !== 'owner') {
      return c.json({ status: 'error', message: 'owner role required' }, 403);
    }
    await next();
  };
}
