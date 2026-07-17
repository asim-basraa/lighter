import { apiBaseUrl } from './inventory.js';

/** A review comment as returned by the API (mirrors the DB row). */
export interface CommentRecord {
  id: number;
  screenId: string;
  version: number;
  elementId: string;
  body: string;
  author: string | null;
  createdAt: string;
}

/** What a reviewer submits to leave a comment. */
export interface NewComment {
  elementId: string;
  body: string;
  author?: string;
}

/** The version's comments plus a load error, if any — mirrors the other loaders. */
export interface LoadedComments {
  comments: CommentRecord[];
  error: string | null;
}

/** A zero-arg request to the comments endpoint, returning a `fetch`-style Response. */
export type CommentsFetcher = () => Response | Promise<Response>;

/** The default server-side fetcher: `GET {LIGHTER_API_URL}/share/:token/comments`, uncached. */
export function apiCommentsFetcher(token: string, baseUrl: string = apiBaseUrl()): CommentsFetcher {
  return () =>
    fetch(new URL(`/share/${encodeURIComponent(token)}/comments`, baseUrl), { cache: 'no-store' });
}

/**
 * Load a shared version's comments (server-side, on the share page). Any failure folds into an empty
 * list + `error` so the review surface degrades to "couldn't load comments" instead of crashing.
 */
export async function loadComments(fetcher: CommentsFetcher): Promise<LoadedComments> {
  try {
    const res = await fetcher();
    if (!res.ok) throw new Error(`Comments API returned ${res.status}`);
    return { comments: (await res.json()) as CommentRecord[], error: null };
  } catch (err) {
    return { comments: [], error: err instanceof Error ? err.message : 'Failed to load comments' };
  }
}

/**
 * Post a comment from the browser. Goes through the same-origin Next route handler (`/api/share/…`),
 * which proxies to the Lighter API server-side — so the API base URL stays off the client. Returns
 * the created comment, or throws with a message the panel can surface.
 */
export async function postComment(token: string, input: NewComment): Promise<CommentRecord> {
  const res = await fetch(`/api/share/${encodeURIComponent(token)}/comments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const message =
      res.status === 422
        ? 'That element is no longer part of this version.'
        : 'Could not post your comment. Please try again.';
    throw new Error(message);
  }
  return (await res.json()) as CommentRecord;
}
