import type { Hono } from 'hono';
import { ZodError } from 'zod';
import { SpecSchema, validateAgainstCatalog, type Catalog, type Spec } from '@lighter/spec';
import {
  SpecStore,
  ScreenExistsError,
  ScreenNotFoundError,
  ScreenEmptyError,
  InvalidNameError,
} from './specStore.js';

/** Loads the current design-system catalog to validate specs against, or null if none is ingested. */
export type CatalogLoader = () => Promise<Catalog | null>;

/**
 * Mount the screen + spec-version routes on the app. Registered only when a SpecStore is configured,
 * so the API can run without the git-backed spec store (e.g. the ingestion-only surface). Screens
 * and their versions live in git; these routes are the CRUD over that store. Saving a version
 * validates the spec against the ingested catalog (via `loadCatalog`).
 */
export function registerScreenRoutes(
  app: Hono,
  store: SpecStore,
  loadCatalog: CatalogLoader,
): void {
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
      if (err instanceof InvalidNameError) {
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

  // Save a new immutable spec version for a screen — an "edit" is just the next version. The spec is
  // validated structurally, then against the ingested catalog; either failure is rejected with
  // structured errors and nothing is written.
  app.post('/screens/:id/versions', async (c) => {
    const id = c.req.param('id');
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    const body = (await c.req.json().catch(() => null)) as { spec?: unknown } | null;
    if (!body || body.spec === undefined) {
      return c.json({ status: 'error', message: 'spec is required' }, 400);
    }

    let parsed: Spec;
    try {
      parsed = SpecSchema.parse(body.spec);
    } catch (err) {
      if (err instanceof ZodError) {
        return c.json(
          { status: 'error', message: 'spec is not structurally valid', issues: err.issues },
          400,
        );
      }
      throw err;
    }

    const catalog = await loadCatalog();
    if (!catalog) {
      return c.json(
        {
          status: 'error',
          message: 'no design-system catalog ingested yet; cannot validate a spec',
        },
        422,
      );
    }
    const issues = validateAgainstCatalog(parsed, catalog);
    if (issues.length > 0) {
      return c.json({ status: 'error', message: 'spec does not match the catalog', issues }, 400);
    }

    try {
      const version = await store.saveVersion(id, parsed);
      return c.json({ version }, 201);
    } catch (err) {
      // The screen could have been removed between the check above and the write (TOCTOU).
      if (err instanceof ScreenNotFoundError) {
        return c.json({ status: 'error', message: err.message }, 404);
      }
      throw err;
    }
  });

  // Duplicate a screen: a new screen whose v1 is a copy of the source's latest spec.
  app.post('/screens/:id/duplicate', async (c) => {
    const sourceId = c.req.param('id');
    const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
    const name = body?.name;
    if (typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ status: 'error', message: 'name (non-empty string) is required' }, 400);
    }
    try {
      const { screen, version } = await store.duplicateScreen(sourceId, name);
      return c.json({ ...screen, version }, 201);
    } catch (err) {
      if (err instanceof ScreenNotFoundError) {
        return c.json({ status: 'error', message: err.message }, 404);
      }
      if (err instanceof ScreenEmptyError) {
        return c.json({ status: 'error', message: err.message }, 422);
      }
      if (err instanceof ScreenExistsError) {
        return c.json({ status: 'error', message: err.message }, 409);
      }
      if (err instanceof InvalidNameError) {
        return c.json({ status: 'error', message: err.message }, 400);
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
