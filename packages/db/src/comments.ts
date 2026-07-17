import { and, asc, eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { comments, type Comment } from './schema.js';

export type { Comment } from './schema.js';

/** The fields a caller supplies to leave a comment. `author` is optional (accountless reviewers). */
export interface NewCommentInput {
  screenId: string;
  version: number;
  elementId: string;
  body: string;
  author?: string | null;
  /** Set when this comment is a reply to a top-level comment (#24). */
  parentId?: number | null;
}

/** Persist a comment (or reply) anchored to a version + element and return the stored row. */
export async function createComment(db: Db, input: NewCommentInput): Promise<Comment> {
  const [row] = await db
    .insert(comments)
    .values({
      screenId: input.screenId,
      version: input.version,
      elementId: input.elementId,
      body: input.body,
      author: input.author ?? null,
      parentId: input.parentId ?? null,
    })
    .returning();
  if (!row) throw new Error('createComment: insert returned no row');
  return row;
}

/** Fetch one comment by id, or null if it doesn't exist. Used to validate a reply's parent. */
export async function getComment(db: Db, id: number): Promise<Comment | null> {
  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return row ?? null;
}

/** All comments on a screen spec version, in creation order (oldest first). */
export async function listComments(db: Db, screenId: string, version: number): Promise<Comment[]> {
  return db
    .select()
    .from(comments)
    .where(and(eq(comments.screenId, screenId), eq(comments.version, version)))
    .orderBy(asc(comments.id));
}

/**
 * Every comment on a screen, across all its versions, ordered by version then creation order. The
 * PM-facing aggregation (#27) groups these by version + element so nothing is lost across iterations.
 */
export async function listCommentsForScreen(db: Db, screenId: string): Promise<Comment[]> {
  return db
    .select()
    .from(comments)
    .where(eq(comments.screenId, screenId))
    .orderBy(asc(comments.version), asc(comments.id));
}
