import type { Hono } from 'hono';
import { ZodError } from 'zod';
import { SpecStore, ScreenExistsError, ScreenNotFoundError } from './specStore.js';

/**
 * Mount the screen + spec-version routes on the app. Registered only when a SpecStore is configured,
 * so the API can run without the git-backed spec store (e.g. the ingestion-only surface). Screens
 * and their versions live in git; these routes are the CRUD over that store.
 */
export function registerScreenRoutes(app: Hono, store: SpecStore): void {
  // Create a screen.
  app.post('/screens', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
    const name = body?.name;
    if (typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ status: 'error', message: 'name (non-empty string) is required' }, 400);
    }
    try {
      return c.json(await store.createScreen(name), 201);
    } catch (err) {
      if (err instanceof ScreenExistsError) {
        return c.json({ status: 'error', message: err.message }, 409);
      }
      if (err instanceof Error && /alphanumeric/.test(err.message)) {
        return c.json({ status: 'error', message: err.message }, 400);
      }
      throw err;
    }
  });

  // List all screens.
  app.get('/screens', async (c) => c.json(await store.listScreens()));

  // A screen's metadata plus its version numbers.
  app.get('/screens/:id', async (c) => {
    const id = c.req.param('id');
    const meta = await store.getScreen(id);
    if (!meta) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    return c.json({ ...meta, versions: await store.listVersions(id) });
  });

  // Save a new immutable spec version for a screen.
  app.post('/screens/:id/versions', async (c) => {
    const id = c.req.param('id');
    const body = (await c.req.json().catch(() => null)) as { spec?: unknown } | null;
    if (!body || body.spec === undefined) {
      return c.json({ status: 'error', message: 'spec is required' }, 400);
    }
    try {
      const version = await store.saveVersion(id, body.spec);
      return c.json({ version }, 201);
    } catch (err) {
      if (err instanceof ScreenNotFoundError) {
        return c.json({ status: 'error', message: err.message }, 404);
      }
      if (err instanceof ZodError) {
        return c.json(
          { status: 'error', message: 'spec is not a valid spec', issues: err.issues },
          400,
        );
      }
      throw err;
    }
  });

  // Fetch one version's spec.
  app.get('/screens/:id/versions/:version', async (c) => {
    const id = c.req.param('id');
    const version = Number(c.req.param('version'));
    if (!Number.isInteger(version) || version < 1) {
      return c.json({ status: 'error', message: 'version must be a positive integer' }, 400);
    }
    const spec = await store.getVersion(id, version);
    if (!spec) {
      return c.json(
        { status: 'error', message: `screen "${id}" version ${version} not found` },
        404,
      );
    }
    return c.json({ version, spec });
  });
}
