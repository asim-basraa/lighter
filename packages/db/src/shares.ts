import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { shares } from './schema.js';

/** A resolved share: which screen version a token points at. */
export interface ShareTarget {
  screenId: string;
  version: number;
}

/** A resolved share plus when it was deployed — what the public renderer needs for its banner. */
export interface ResolvedShare extends ShareTarget {
  /** When the version was first deployed (SQLite UTC timestamp, `YYYY-MM-DD HH:MM:SS`). */
  createdAt: string;
}

/** A minted share: its token plus the version it addresses. */
export interface Share extends ShareTarget {
  token: string;
}

/** 16 random bytes → 32 hex chars (128 bits). Unguessable; the sole credential to view a mock. */
function mintToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Create (or reuse) a share link for a screen spec version. Idempotent per (screenId, version): a
 * version has at most one share, so re-deploying it returns the same stable token/URL. The unique
 * index on (screen_id, version) makes this race-safe. `expiresAt` (an ISO timestamp, or null for no
 * expiry) is (re)set on every deploy — so a re-deploy can set, change, or clear the expiry while
 * keeping the same token. Whether the version actually exists is the caller's concern (the API checks
 * the spec store before minting).
 */
export async function createShare(
  db: Db,
  screenId: string,
  version: number,
  expiresAt: string | null = null,
): Promise<Share> {
  await db
    .insert(shares)
    .values({ token: mintToken(), screenId, version, expiresAt })
    .onConflictDoUpdate({ target: [shares.screenId, shares.version], set: { expiresAt } });
  const [row] = await db
    .select()
    .from(shares)
    .where(and(eq(shares.screenId, screenId), eq(shares.version, version)))
    .limit(1);
  if (!row) throw new Error('createShare: insert returned no row');
  return { token: row.token, screenId: row.screenId, version: row.version };
}

/**
 * Resolve a share token to its target version (with deploy time), or null if the token is unknown OR
 * expired (#34). Expiry is checked against `now` (injectable for tests); a share whose `expiresAt` is
 * at or before `now` is refused exactly like an unknown token, so an expired link can't be viewed.
 */
export async function resolveShare(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<ResolvedShare | null> {
  const [row] = await db.select().from(shares).where(eq(shares.token, token)).limit(1);
  if (!row) return null;
  if (row.expiresAt !== null) {
    const at = new Date(row.expiresAt).getTime();
    // Fail closed: a malformed (NaN) or past expiry is refused, never treated as non-expiring.
    if (Number.isNaN(at) || at <= now.getTime()) return null;
  }
  return { screenId: row.screenId, version: row.version, createdAt: row.createdAt };
}

/**
 * The share token for a screen's highest-versioned deployed version that is still LIVE (not expired),
 * or null if none — so a flow link (#30) lands on a real, viewable mock rather than a link that dead-
 * ends in a 404. Only rows in `shares` (deployed versions) are considered; expired ones are skipped.
 */
export async function latestShareForScreen(
  db: Db,
  screenId: string,
  now: Date = new Date(),
): Promise<string | null> {
  const rows = await db
    .select()
    .from(shares)
    .where(eq(shares.screenId, screenId))
    .orderBy(desc(shares.version));
  for (const row of rows) {
    if (row.expiresAt === null) return row.token;
    const at = new Date(row.expiresAt).getTime();
    if (!Number.isNaN(at) && at > now.getTime()) return row.token;
  }
  return null;
}
