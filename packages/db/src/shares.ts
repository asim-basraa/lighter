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
 * index on (screen_id, version) makes this race-safe — a concurrent insert is discarded, then the
 * canonical row is read back. Whether the version actually exists is the caller's concern (the API
 * checks the spec store before minting).
 */
export async function createShare(db: Db, screenId: string, version: number): Promise<Share> {
  await db
    .insert(shares)
    .values({ token: mintToken(), screenId, version })
    .onConflictDoNothing({ target: [shares.screenId, shares.version] });
  const [row] = await db
    .select()
    .from(shares)
    .where(and(eq(shares.screenId, screenId), eq(shares.version, version)))
    .limit(1);
  if (!row) throw new Error('createShare: insert returned no row');
  return { token: row.token, screenId: row.screenId, version: row.version };
}

/** Resolve a share token to its target version (with deploy time), or null if the token is unknown. */
export async function resolveShare(db: Db, token: string): Promise<ResolvedShare | null> {
  const [row] = await db.select().from(shares).where(eq(shares.token, token)).limit(1);
  return row ? { screenId: row.screenId, version: row.version, createdAt: row.createdAt } : null;
}

/**
 * The share token for a screen's most-recently deployed version, or null if none is deployed. Used to
 * resolve a flow link (#30) to the current deployed mock of its target screen.
 */
export async function latestShareForScreen(db: Db, screenId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(shares)
    .where(eq(shares.screenId, screenId))
    .orderBy(desc(shares.version))
    .limit(1);
  return row ? row.token : null;
}
