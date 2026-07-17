import { and, eq, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { versionStatus } from './schema.js';

/**
 * Read a version's stored approval state, or null if none has been set yet (the caller treats null as
 * the default 'draft'). State strings are opaque to the DB layer — the state machine lives in the API.
 */
export async function getVersionState(
  db: Db,
  screenId: string,
  version: number,
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(versionStatus)
    .where(and(eq(versionStatus.screenId, screenId), eq(versionStatus.version, version)))
    .limit(1);
  return row ? row.state : null;
}

/** Upsert a version's approval state (one row per screen+version). */
export async function setVersionState(
  db: Db,
  screenId: string,
  version: number,
  state: string,
): Promise<void> {
  await db
    .insert(versionStatus)
    .values({ screenId, version, state })
    .onConflictDoUpdate({
      target: [versionStatus.screenId, versionStatus.version],
      set: { state, updatedAt: sql`CURRENT_TIMESTAMP` },
    });
}
