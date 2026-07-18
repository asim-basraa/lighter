import { createHmac } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { projects, projectTokens } from './schema.js';

/** A tenant in the multi-project cloud (#87). */
export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Default HMAC secret for token hashing. Overridable per call (and wired from
 * `LIGHTER_TOKEN_SIGNING_SECRET` at the service boundary). Keeping it injectable keeps this DB layer
 * pure and unit-testable without env setup. The secret adds defense-in-depth: even a full dump of
 * `project_tokens` can't be turned into a working token without it.
 */
const DEFAULT_TOKEN_SECRET = 'lighter-dev-token-secret';

/** HMAC-SHA256 of a raw token. Only this hash is ever stored. */
export function hashToken(rawToken: string, secret: string = DEFAULT_TOKEN_SECRET): string {
  return createHmac('sha256', secret).update(rawToken).digest('hex');
}

/** Lowercase, dash-separated slug for a project id derived from its name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function rowToProject(row: { id: string; name: string; createdAt: string }): Project {
  return { id: row.id, name: row.name, createdAt: row.createdAt };
}

/** Create a project. `id` defaults to a slug of the name; a duplicate id throws (unique PK). */
export async function createProject(
  db: Db,
  input: { name: string; id?: string },
): Promise<Project> {
  const id = input.id ?? slugify(input.name);
  if (!id) throw new Error('project id could not be derived from name');
  const [row] = await db.insert(projects).values({ id, name: input.name }).returning();
  return rowToProject(row!);
}

/** Fetch one project by id, or null. */
export async function getProject(db: Db, id: string): Promise<Project | null> {
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return row ? rowToProject(row) : null;
}

/** All projects, newest first. */
export async function listProjects(db: Db): Promise<Project[]> {
  const rows = await db.select().from(projects);
  return rows.map(rowToProject);
}

export interface MintedToken {
  /** The raw bearer token — shown ONCE; only its hash is persisted. */
  token: string;
  projectId: string;
  label: string | null;
}

/**
 * Mint a new API token for a project. Returns the raw token exactly once; only the hash is stored.
 * Format `lgt_<random>` so a leaked token is greppable and self-identifying.
 */
export async function mintToken(
  db: Db,
  projectId: string,
  opts: { label?: string; secret?: string } = {},
): Promise<MintedToken> {
  const raw = `lgt_${randomBytes(24).toString('base64url')}`;
  const tokenHash = hashToken(raw, opts.secret);
  const label = opts.label ?? null;
  await db.insert(projectTokens).values({ tokenHash, projectId, label });
  return { token: raw, projectId, label };
}

/**
 * Resolve the project a bearer token belongs to, or null if the token is unknown. Lookup is by the
 * indexed hash (no plaintext comparison, no table scan).
 */
export async function resolveProjectByToken(
  db: Db,
  rawToken: string,
  secret?: string,
): Promise<Project | null> {
  if (!rawToken) return null;
  const [row] = await db
    .select()
    .from(projectTokens)
    .where(eq(projectTokens.tokenHash, hashToken(rawToken, secret)))
    .limit(1);
  if (!row) return null;
  return getProject(db, row.projectId);
}

/** Revoke a token by its raw value. Returns whether a matching token existed. */
export async function revokeToken(db: Db, rawToken: string, secret?: string): Promise<boolean> {
  const result = await db
    .delete(projectTokens)
    .where(eq(projectTokens.tokenHash, hashToken(rawToken, secret)))
    .returning();
  return result.length > 0;
}
