import type { Hono } from 'hono';
import { toJsonRender } from '@lighter/spec';
import {
  createComment,
  listComments,
  listCommentsForScreen,
  getComment,
  resolveShare,
  type Db,
} from '@lighter/db';
import type { ScreenScope } from './screenScope.js';
import { aggregateComments } from './commentAggregation.js';
import { safeNotify, type Notifier } from './notifier.js';

/**
 * Mount the review-comment routes, reached through a share token so a reviewer needs no account.
 * A comment is anchored to a json-render element id (`el-0`, …) of the shared version — structural,
 * not pixel-based, so it survives layout changes. The token pins the (screen, version), which is
 * what a comment is keyed by. Registered only when a spec store is configured.
 *
 *   POST /share/:token/comments  { elementId, body, author? }             — leave a comment
 *   POST /share/:token/comments  { parentId, body, author? }               — reply to a comment
 *   GET  /share/:token/comments                                            — list (flat; parentId)
 *
 * A reply carries a `parentId` instead of an `elementId`: it inherits the parent's element anchor, so
 * a thread is always scoped to one element + version. Threads are one level deep — you can't reply to
 * a reply. The GET returns a flat list (each row carries `parentId`); the thread tree is built client-
 * side, and #27 aggregates over the same rows.
 */
/** Caps on reviewer-supplied text. This is a public, unauthenticated write surface, so bound the
 * stored size to keep a single link from being used to grow the DB without limit. */
const MAX_BODY = 4000;
const MAX_AUTHOR = 120;

export function registerCommentRoutes(
  app: Hono,
  db: Db,
  scope: ScreenScope,
  notifier?: Notifier,
): void {
  app.post('/share/:token/comments', async (c) => {
    const target = await resolveShare(db, c.req.param('token'));
    if (!target) {
      return c.json({ status: 'error', message: 'share not found' }, 404);
    }
    const resolved = await scope.resolveKey(target.screenId);
    if (!resolved) {
      return c.json({ status: 'error', message: 'share not found' }, 404);
    }
    const spec = await resolved.store.getVersion(resolved.screenId, target.version);
    if (!spec) {
      return c.json({ status: 'error', message: 'share not found' }, 404);
    }
    const body = (await c.req.json().catch(() => null)) as {
      elementId?: unknown;
      body?: unknown;
      author?: unknown;
      parentId?: unknown;
    } | null;
    const text = body?.body;
    if (typeof text !== 'string' || text.trim().length === 0) {
      return c.json({ status: 'error', message: 'body (non-empty string) is required' }, 400);
    }
    if (text.length > MAX_BODY) {
      return c.json(
        { status: 'error', message: `body must be at most ${MAX_BODY} characters` },
        400,
      );
    }
    const author = typeof body?.author === 'string' && body.author.trim() ? body.author : null;
    if (author !== null && author.length > MAX_AUTHOR) {
      return c.json(
        { status: 'error', message: `author must be at most ${MAX_AUTHOR} characters` },
        400,
      );
    }

    // Resolve the anchor: a reply (parentId) inherits its parent's element; a top-level comment
    // supplies an elementId that must be a real element of this version's spec.
    let elementId: string;
    let parentId: number | null = null;
    if (body?.parentId !== undefined && body.parentId !== null) {
      if (!Number.isInteger(body.parentId)) {
        return c.json({ status: 'error', message: 'parentId must be an integer' }, 400);
      }
      const parent = await getComment(db, body.parentId as number);
      // The parent must belong to the very version this token points at.
      if (!parent || parent.screenId !== target.screenId || parent.version !== target.version) {
        return c.json({ status: 'error', message: 'parent comment not found' }, 404);
      }
      if (parent.parentId !== null) {
        return c.json({ status: 'error', message: 'can only reply to a top-level comment' }, 400);
      }
      elementId = parent.elementId; // a reply is anchored to the parent's element
      parentId = parent.id;
    } else {
      const anchor = body?.elementId;
      if (typeof anchor !== 'string' || anchor.length === 0) {
        return c.json(
          { status: 'error', message: 'elementId (non-empty string) is required' },
          400,
        );
      }
      // A stored spec that can't serialize (e.g. a reserved-key prop) is a data problem, not a 500.
      let elementIds: Set<string>;
      try {
        elementIds = new Set(Object.keys(toJsonRender(spec).elements));
      } catch {
        return c.json({ status: 'error', message: 'this version cannot be anchored to' }, 422);
      }
      if (!elementIds.has(anchor)) {
        return c.json(
          { status: 'error', message: `element "${anchor}" is not in this version` },
          422,
        );
      }
      elementId = anchor;
    }

    const comment = await createComment(db, {
      screenId: target.screenId,
      version: target.version,
      elementId,
      body: text,
      author,
      parentId,
    });
    // Notify the team a comment landed (never blocks the reviewer — see safeNotify).
    await safeNotify(notifier, {
      kind: 'comment',
      screenId: comment.screenId,
      version: comment.version,
      elementId: comment.elementId,
      author: comment.author,
      body: comment.body,
      parentId: comment.parentId,
    });
    return c.json(comment, 201);
  });

  app.get('/share/:token/comments', async (c) => {
    const target = await resolveShare(db, c.req.param('token'));
    if (!target) {
      return c.json({ status: 'error', message: 'share not found' }, 404);
    }
    return c.json(await listComments(db, target.screenId, target.version));
  });

  // PM-facing aggregation (#27): a screen's comments across every version, grouped by version then
  // element, with thread contents — so feedback is not lost across iterations. Internal (by screen id,
  // not a share token). Also the context #28 feeds back into generation.
  app.get('/screens/:id/comments', async (c) => {
    const id = c.req.param('id');
    const store = await scope.storeFor(c);
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    const rows = await listCommentsForScreen(db, scope.keyFor(c, id));
    return c.json({ screen: id, versions: aggregateComments(rows) });
  });
}
