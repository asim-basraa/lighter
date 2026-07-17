import type { Hono } from 'hono';
import { getFlow, setFlow, type Db, type FlowLinkInput } from '@lighter/db';
import type { SpecStore } from './specStore.js';

/**
 * Mount the click-through flow routes (#30). A screen's flow is an ordered list of labelled links to
 * other screens; the deployed mock renders them as navigation so a reviewer can click through a
 * multi-screen journey. Registered only when a spec store is configured.
 *
 *   GET /screens/:id/flow   — the configured flow links
 *   PUT /screens/:id/flow   — configure them (each target must be an existing screen)
 */
export function registerFlowRoutes(app: Hono, db: Db, store: SpecStore): void {
  app.get('/screens/:id/flow', async (c) => {
    const id = c.req.param('id');
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    return c.json({ links: await getFlow(db, id) });
  });

  app.put('/screens/:id/flow', async (c) => {
    const id = c.req.param('id');
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    const body = (await c.req.json().catch(() => null)) as { links?: unknown } | null;
    const links = body?.links;
    if (!Array.isArray(links)) {
      return c.json({ status: 'error', message: 'links (array) is required' }, 400);
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
      // The target must be a real screen, so a flow link can never point at nothing.
      if (!(await store.getScreen(link.target))) {
        return c.json(
          { status: 'error', message: `target screen "${link.target}" not found` },
          400,
        );
      }
      clean.push({ label: link.label, target: link.target });
    }
    await setFlow(db, id, clean);
    return c.json({ links: await getFlow(db, id) });
  });
}
