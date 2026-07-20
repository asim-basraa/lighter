import { and, eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { previewOrigins } from './schema.js';

export interface PreviewOrigin {
  origin: string;
  label: string | null;
  createdAt: string;
}

/**
 * A bare origin — scheme + host + optional port. No path, query, fragment or credentials.
 *
 * This is the security boundary for live preview (#166), so it is deliberately strict: anything the
 * studio will frame, or postMessage a spec to, must normalise to exactly what was allowlisted.
 * `https://evil.com/path`, `https://evil.com#x` and `https://user:pw@evil.com` are all rejected
 * rather than silently truncated to their origin, because a caller who wrote them meant something
 * else and should be told.
 */
export function isValidOrigin(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.search || url.hash) return false;
  if (url.pathname !== '/') return false;
  // `new URL` keeps a trailing slash in href but not in origin; compare against the input minus one.
  return url.origin === value.replace(/\/$/, '');
}

/** Whether an origin points at the local machine — the case that can only ever expose its author. */
export function isLoopbackOrigin(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

export async function listPreviewOrigins(db: Db, projectId: string): Promise<PreviewOrigin[]> {
  const rows = await db
    .select()
    .from(previewOrigins)
    .where(eq(previewOrigins.projectId, projectId));
  return rows
    .map((r) => ({ origin: r.origin, label: r.label, createdAt: r.createdAt }))
    .sort((a, b) => a.origin.localeCompare(b.origin));
}

export class InvalidOriginError extends Error {}

/** Add an origin to a project's allowlist. Idempotent — re-adding updates the label. */
export async function addPreviewOrigin(
  db: Db,
  projectId: string,
  origin: string,
  label?: string | null,
): Promise<PreviewOrigin> {
  if (!isValidOrigin(origin)) {
    throw new InvalidOriginError(
      `"${origin}" is not a bare origin. Use scheme://host[:port] with no path.`,
    );
  }
  await db
    .insert(previewOrigins)
    .values({ projectId, origin, label: label ?? null })
    .onConflictDoUpdate({
      target: [previewOrigins.projectId, previewOrigins.origin],
      set: { label: label ?? null },
    });
  const found = (await listPreviewOrigins(db, projectId)).find((o) => o.origin === origin);
  return found ?? { origin, label: label ?? null, createdAt: '' };
}

export async function removePreviewOrigin(
  db: Db,
  projectId: string,
  origin: string,
): Promise<boolean> {
  const before = await listPreviewOrigins(db, projectId);
  if (!before.some((o) => o.origin === origin)) return false;
  await db
    .delete(previewOrigins)
    .where(and(eq(previewOrigins.projectId, projectId), eq(previewOrigins.origin, origin)));
  return true;
}

/**
 * Whether the studio may frame `origin` for this project.
 *
 * Loopback is allowed without being stored: a `localhost` frame can only ever expose the person who
 * opened it, it can't be shared meaningfully, and requiring setup for the primary authoring loop is
 * friction with no security return.
 */
export async function isPreviewOriginAllowed(
  db: Db,
  projectId: string,
  origin: string,
): Promise<boolean> {
  if (!isValidOrigin(origin)) return false;
  if (isLoopbackOrigin(origin)) return true;
  const allowed = await listPreviewOrigins(db, projectId);
  return allowed.some((o) => o.origin === origin);
}
