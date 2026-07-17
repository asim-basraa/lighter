import { asc, eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { flowLinks } from './schema.js';

/** A click-through flow link: a label and the screen it navigates to. */
export interface FlowLinkInput {
  label: string;
  target: string;
}

/** The ordered flow links configured for a screen (empty when none). */
export async function getFlow(db: Db, screenId: string): Promise<FlowLinkInput[]> {
  const rows = await db
    .select()
    .from(flowLinks)
    .where(eq(flowLinks.screenId, screenId))
    .orderBy(asc(flowLinks.position));
  return rows.map((r) => ({ label: r.label, target: r.targetScreenId }));
}

/** Replace a screen's flow links (delete-then-insert in one transaction, so it never half-applies). */
export async function setFlow(db: Db, screenId: string, links: FlowLinkInput[]): Promise<void> {
  db.transaction((tx) => {
    tx.delete(flowLinks).where(eq(flowLinks.screenId, screenId)).run();
    if (links.length > 0) {
      tx.insert(flowLinks)
        .values(
          links.map((l, i) => ({
            screenId,
            position: i,
            label: l.label,
            targetScreenId: l.target,
          })),
        )
        .run();
    }
  });
}
