import type { Comment } from '@lighter/db';

/** A top-level comment with its replies, in creation order. */
export interface CommentThread {
  root: Comment;
  replies: Comment[];
}

/** All comment threads anchored to one element. */
export interface ElementComments {
  elementId: string;
  threads: CommentThread[];
}

/** All comment threads on one version, grouped by element. */
export interface VersionComments {
  version: number;
  elements: ElementComments[];
}

/**
 * Aggregate a screen's flat comment list (across versions, in version+creation order) into the
 * PM-facing shape: grouped by version, then by element, each as threads (root + replies). This is
 * what keeps feedback from being lost across iterations (#27) and is the context #28 feeds back into
 * generation. Replies inherit their root's element + version, so grouping by the root is sufficient.
 */
export function aggregateComments(comments: Comment[]): VersionComments[] {
  const repliesByParent = new Map<number, Comment[]>();
  for (const c of comments) {
    if (c.parentId !== null) {
      const bucket = repliesByParent.get(c.parentId);
      if (bucket) bucket.push(c);
      else repliesByParent.set(c.parentId, [c]);
    }
  }

  // Nested insertion-ordered maps preserve the version+creation order the rows arrive in.
  const byVersion = new Map<number, Map<string, CommentThread[]>>();
  for (const c of comments) {
    if (c.parentId !== null) continue; // replies are attached to their root, not grouped directly
    let byElement = byVersion.get(c.version);
    if (!byElement) {
      byElement = new Map();
      byVersion.set(c.version, byElement);
    }
    const thread: CommentThread = { root: c, replies: repliesByParent.get(c.id) ?? [] };
    const threads = byElement.get(c.elementId);
    if (threads) threads.push(thread);
    else byElement.set(c.elementId, [thread]);
  }

  return [...byVersion].map(([version, byElement]) => ({
    version,
    elements: [...byElement].map(([elementId, threads]) => ({ elementId, threads })),
  }));
}
