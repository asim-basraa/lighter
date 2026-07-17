import type { CommentRecord } from './comments.js';

/** A top-level comment together with its replies, in creation order. */
export interface CommentThread {
  root: CommentRecord;
  replies: CommentRecord[];
}

/**
 * Build one-level threads from a flat, creation-ordered comment list: each top-level comment (no
 * `parentId`) becomes a thread root, with its replies grouped beneath it in order. An orphan reply
 * (parent not present) is dropped rather than shown detached — the API only ever produces valid
 * parents, so this is just defensive.
 */
export function threadComments(comments: CommentRecord[]): CommentThread[] {
  const threads: CommentThread[] = [];
  const byId = new Map<number, CommentThread>();
  for (const comment of comments) {
    if (comment.parentId === null) {
      const thread: CommentThread = { root: comment, replies: [] };
      threads.push(thread);
      byId.set(comment.id, thread);
    }
  }
  for (const comment of comments) {
    if (comment.parentId !== null) {
      byId.get(comment.parentId)?.replies.push(comment);
    }
  }
  return threads;
}
