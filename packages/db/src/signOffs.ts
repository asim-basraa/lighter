import { and, eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { signOffConfig, signOffs } from './schema.js';

/** A required sign-off party: an identifier plus its role. */
export interface SignOffPartyInput {
  party: string;
  role: string;
}

/** The configured required sign-off parties for a screen (empty when none configured). */
export async function getSignOffSet(db: Db, screenId: string): Promise<SignOffPartyInput[]> {
  const rows = await db.select().from(signOffConfig).where(eq(signOffConfig.screenId, screenId));
  return rows.map((r) => ({ party: r.party, role: r.role }));
}

/**
 * Replace a screen's required sign-off set with the given parties. The delete + insert run in one
 * transaction, so a failed insert can't leave the screen with an empty (ungated) set — the prior
 * gated set is preserved. This is the security-relevant control, so it must not fail open.
 */
export async function setSignOffSet(
  db: Db,
  screenId: string,
  parties: SignOffPartyInput[],
): Promise<void> {
  db.transaction((tx) => {
    tx.delete(signOffConfig).where(eq(signOffConfig.screenId, screenId)).run();
    if (parties.length > 0) {
      tx.insert(signOffConfig)
        .values(parties.map((p) => ({ screenId, party: p.party, role: p.role })))
        .run();
    }
  });
}

/** Record a party's sign-off on a version (idempotent — signing twice is a no-op). */
export async function recordSignOff(
  db: Db,
  screenId: string,
  version: number,
  party: string,
): Promise<void> {
  await db
    .insert(signOffs)
    .values({ screenId, version, party })
    .onConflictDoNothing({ target: [signOffs.screenId, signOffs.version, signOffs.party] });
}

/** The parties that have signed off a specific version. */
export async function listSignOffs(db: Db, screenId: string, version: number): Promise<string[]> {
  const rows = await db
    .select()
    .from(signOffs)
    .where(and(eq(signOffs.screenId, screenId), eq(signOffs.version, version)));
  return rows.map((r) => r.party);
}
