import type { Hono } from 'hono';
import { toJsonRender } from '@lighter/spec';
import { createComment, listComments, resolveShare, type Db } from '@lighter/db';
import type { SpecStore } from './specStore.js';

/**
 * Mount the review-comment routes, reached through a share token so a reviewer needs no account.
 * A comment is anchored to a json-render element id (`el-0`, …) of the shared version — structural,
 * not pixel-based, so it survives layout changes. The token pins the (screen, version), which is
 * what a comment is keyed by. Registered only when a spec store is configured.
 *
 *   POST /share/:token/comments  { elementId, body, author? }  — leave a comment
 *   GET  /share/:token/comments                                — list the version's comments
 */
/** Caps on reviewer-supplied text. This is a public, unauthenticated write surface, so bound the
 * stored size to keep a single link from being used to grow the DB without limit. */
const MAX_BODY = 4000;
const MAX_AUTHOR = 120;

export function registerCommentRoutes(app: Hono, db: Db, store: SpecStore): void {
  app.post('/share/:token/comments', async (c) => {
    const target = await resolveShare(db, c.req.param('token'));
    if (!target) {
      return c.json({ status: 'error', message: 'share not found' }, 404);
    }
    const spec = await store.getVersion(target.screenId, target.version);
    if (!spec) {
      return c.json({ status: 'error', message: 'share not found' }, 404);
    }
    const body = (await c.req.json().catch(() => null)) as {
      elementId?: unknown;
      body?: unknown;
      author?: unknown;
    } | null;
    const elementId = body?.elementId;
    const text = body?.body;
    if (typeof elementId !== 'string' || elementId.length === 0) {
      return c.json({ status: 'error', message: 'elementId (non-empty string) is required' }, 400);
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      return c.json({ status: 'error', message: 'body (non-empty string) is required' }, 400);
    }
    if (text.length > MAX_BODY) {
      return c.json(
        { status: 'error', message: `body must be at most ${MAX_BODY} characters` },
        400,
      );
    }
    const rawAuthor = typeof body?.author === 'string' && body.author.trim() ? body.author : null;
    if (rawAuthor !== null && rawAuthor.length > MAX_AUTHOR) {
      return c.json(
        { status: 'error', message: `author must be at most ${MAX_AUTHOR} characters` },
        400,
      );
    }
    // The anchor must be a real element of THIS version's spec, so a comment can never dangle on an
    // id that isn't in the tree. Element ids are the keys of the json-render element map. A stored
    // spec that can't serialize (e.g. a reserved-key prop) is a data problem, not a 500 — report it.
    let elementIds: Set<string>;
    try {
      elementIds = new Set(Object.keys(toJsonRender(spec).elements));
    } catch {
      return c.json({ status: 'error', message: 'this version cannot be anchored to' }, 422);
    }
    if (!elementIds.has(elementId)) {
      return c.json(
        { status: 'error', message: `element "${elementId}" is not in this version` },
        422,
      );
    }
    const author = rawAuthor;
    const comment = await createComment(db, {
      screenId: target.screenId,
      version: target.version,
      elementId,
      body: text,
      author,
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
}
