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
}

/** Persist a comment anchored to a version + element and return the stored row. */
export async function createComment(db: Db, input: NewCommentInput): Promise<Comment> {
  const [row] = await db
    .insert(comments)
    .values({
      screenId: input.screenId,
      version: input.version,
      elementId: input.elementId,
      body: input.body,
      author: input.author ?? null,
    })
    .returning();
  if (!row) throw new Error('createComment: insert returned no row');
  return row;
}

/** All comments on a screen spec version, in creation order (oldest first). */
export async function listComments(db: Db, screenId: string, version: number): Promise<Comment[]> {
  return db
    .select()
    .from(comments)
    .where(and(eq(comments.screenId, screenId), eq(comments.version, version)))
    .orderBy(asc(comments.id));
}
