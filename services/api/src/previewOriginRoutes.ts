import type { Hono } from 'hono';
import {
  listPreviewOrigins,
  addPreviewOrigin,
  removePreviewOrigin,
  InvalidOriginError,
  type Db,
} from '@lighter/db';
import { requireProject, type AuthConfig } from './auth.js';

/**
 * The live-preview origin allowlist (#166) — which app origins the studio may frame for a project.
 *
 * Deliberately on the **dual-credential** guard (`requireProject`), not the human-only one used by
 * team administration. Two reasons:
 *
 * - Choosing which app to preview is an *authoring* decision, not an administrative one. Gating it
 *   behind ownership would push people straight back to hard-coded env vars, which is what this
 *   replaces.
 * - The studio can run on a project token (the pre-Supabase-Auth path), and a studio that can read
 *   screens but not its own preview config would be broken in that mode.
 *
 * The project always comes from the resolved credential, never from the path, so one project's token
 * can't read or mutate another's allowlist.
 */
export function registerPreviewOriginRoutes(app: Hono, db: Db, config: AuthConfig): void {
  const guard = requireProject(config);

  app.get('/preview-origins', guard, async (c) => {
    return c.json(await listPreviewOrigins(db, c.get('project').id));
  });

  app.post('/preview-origins', guard, async (c) => {
    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const origin = typeof body.origin === 'string' ? body.origin.trim() : '';
    const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : null;
    if (!origin) return c.json({ status: 'error', message: 'origin is required' }, 400);
    try {
      const added = await addPreviewOrigin(db, c.get('project').id, origin, label);
      return c.json(added, 201);
    } catch (error) {
      if (error instanceof InvalidOriginError) {
        return c.json({ status: 'error', message: error.message }, 400);
      }
      throw error;
    }
  });

  app.delete('/preview-origins', guard, async (c) => {
    const origin = c.req.query('origin') ?? '';
    if (!origin) return c.json({ status: 'error', message: 'origin is required' }, 400);
    const removed = await removePreviewOrigin(db, c.get('project').id, origin);
    if (!removed) return c.json({ status: 'error', message: 'origin not found' }, 404);
    return c.json({ status: 'removed' });
  });
}
