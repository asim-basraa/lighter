import { eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { ingestedCommits } from './schema.js';

/** Whether a commit sha has already been ingested via the webhook (#36 idempotency). */
export async function wasCommitIngested(db: Db, commitSha: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(ingestedCommits)
    .where(eq(ingestedCommits.commitSha, commitSha))
    .limit(1);
  return row !== undefined;
}

/** Record a commit sha as ingested. Idempotent — recording the same sha twice is a no-op. */
export async function recordIngestedCommit(db: Db, commitSha: string): Promise<void> {
  await db
    .insert(ingestedCommits)
    .values({ commitSha })
    .onConflictDoNothing({ target: ingestedCommits.commitSha });
}
