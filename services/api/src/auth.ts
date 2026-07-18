import type { MiddlewareHandler } from 'hono';
import { resolveProjectByToken, type Db, type Project } from '@lighter/db';

// Make the resolved project available to downstream handlers as a typed context variable.
declare module 'hono' {
  interface ContextVariableMap {
    project: Project;
  }
}

/** Config for the project bearer-auth middleware (#87). Wired from the service env at `createApp`. */
export interface AuthConfig {
  db: Db;
  /** HMAC secret for token hashing (from `LIGHTER_TOKEN_SIGNING_SECRET`); undefined → the dev default. */
  tokenSecret?: string;
}

/** Extract a bearer token from an Authorization header, or undefined. */
function bearerToken(header: string | undefined): string | undefined {
  if (!header || !/^Bearer\s+/i.test(header)) return undefined;
  return header.replace(/^Bearer\s+/i, '').trim() || undefined;
}

/**
 * Require a valid project API token. On success the resolved project is attached to the context
 * (`c.get('project')`); on a missing or unknown token the request is refused 401 without leaking
 * whether the token existed. This is the machine-auth lane (CLI / GitHub Action); human/studio login
 * is Supabase Auth (#91).
 */
export function requireProject(config: AuthConfig): MiddlewareHandler {
  return async (c, next) => {
    const token = bearerToken(c.req.header('authorization'));
    if (!token) return c.json({ status: 'error', message: 'missing bearer token' }, 401);
    const project = await resolveProjectByToken(config.db, token, config.tokenSecret);
    if (!project) return c.json({ status: 'error', message: 'invalid token' }, 401);
    c.set('project', project);
    await next();
  };
}
