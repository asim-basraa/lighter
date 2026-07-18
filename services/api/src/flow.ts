import type { Hono } from 'hono';
import { getFlow, setFlow, type Db, type FlowLinkInput } from '@lighter/db';
import type { ScreenScope } from './screenScope.js';

/**
 * Mount the click-through flow routes (#30). A screen's flow is an ordered list of labelled links to
 * other screens; the deployed mock renders them as navigation so a reviewer can click through a
 * multi-screen journey. Registered only when a spec store is configured.
 *
 *   GET /screens/:id/flow   — the configured flow links
 *   PUT /screens/:id/flow   — configure them (each target must be an existing screen)
 */
/** Bound the flow size: each link is a DB query on the public share read, so keep it small. */
const MAX_FLOW_LINKS = 20;

export function registerFlowRoutes(app: Hono, db: Db, scope: ScreenScope): void {
  app.get('/screens/:id/flow', async (c) => {
    const id = c.req.param('id');
    const store = await scope.storeFor(c);
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    return c.json({ links: await getFlow(db, scope.keyFor(c, id)) });
  });

  app.put('/screens/:id/flow', async (c) => {
    const id = c.req.param('id');
    const store = await scope.storeFor(c);
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    const body = (await c.req.json().catch(() => null)) as { links?: unknown } | null;
    const links = body?.links;
    if (!Array.isArray(links)) {
      return c.json({ status: 'error', message: 'links (array) is required' }, 400);
    }
    if (links.length > MAX_FLOW_LINKS) {
      return c.json(
        { status: 'error', message: `a flow may have at most ${MAX_FLOW_LINKS} links` },
        400,
      );
    }
    const clean: FlowLinkInput[] = [];
    for (const raw of links) {
      if (raw === null || typeof raw !== 'object') {
        return c.json({ status: 'error', message: 'each link must be an object' }, 400);
      }
      const link = raw as { label?: unknown; target?: unknown };
      if (typeof link.label !== 'string' || link.label.trim().length === 0) {
        return c.json({ status: 'error', message: 'each link needs a non-empty label' }, 400);
      }
      if (typeof link.target !== 'string' || link.target.trim().length === 0) {
        return c.json({ status: 'error', message: 'each link needs a target screen id' }, 400);
      }
      // The target must be a real screen in the same scope, so a link can never point at nothing.
      if (!(await store.getScreen(link.target))) {
        return c.json(
          { status: 'error', message: `target screen "${link.target}" not found` },
          400,
        );
      }
      clean.push({ label: link.label, target: link.target });
    }
    const key = scope.keyFor(c, id);
    await setFlow(db, key, clean);
    return c.json({ links: await getFlow(db, key) });
  });
}
