import type { Context, Hono } from 'hono';
import { ZodError } from 'zod';
import {
  SpecSchema,
  validateAgainstCatalog,
  componentTypesOf,
  staleComponents,
  type Catalog,
  type Spec,
} from '@lighter/spec';
import {
  SpecStore,
  ScreenExistsError,
  ScreenNotFoundError,
  ScreenEmptyError,
  InvalidNameError,
} from './specStore.js';

/** Resolve the SpecStore for a request — the single global store, or the caller's project store (#87). */
export type StoreResolver = (c: Context) => Promise<SpecStore>;

/** Loads the catalog to validate specs against (global, or the caller's project), or null if none. */
export type CatalogResolver = (c: Context) => Promise<Catalog | null>;

/**
 * Mount the screen + spec-version routes on the app. Registered only when a spec store is configured.
 * The store and catalog are resolved per-request (`resolveStore`/`resolveCatalog`), so the same route
 * logic serves both the single global store and a per-project scoped store (#87). Screens and their
 * versions live in git; these routes are the CRUD over that store. Saving a version validates the
 * spec against the ingested catalog.
 */
export function registerScreenRoutes(
  app: Hono,
  resolveStore: StoreResolver,
  resolveCatalog: CatalogResolver,
): void {
  // Create a screen.
  app.post('/screens', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
    const name = body?.name;
    if (typeof name !== 'string' || name.trim().length === 0) {
      return c.json({ status: 'error', message: 'name (non-empty string) is required' }, 400);
    }
    const store = await resolveStore(c);
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
  app.get('/screens', async (c) => c.json(await (await resolveStore(c)).listScreens()));

  // Derived usage records — one per screen's LATEST version — for the dashboard's blast-radius view:
  // { screen (name), version (`v{n}`), components (referenced types) }. Screens with no version are
  // omitted. This is the current blast radius (what today's designs use), not full history.
  //
  // Each record also carries staleness (#37): components the spec references that no longer exist in
  // the current catalog (removed/renamed) — `stale` + the offending `staleComponents`. When no
  // catalog is ingested we can't judge, so specs are reported not-stale.
  app.get('/specs', async (c) => {
    const store = await resolveStore(c);
    const catalog = await resolveCatalog(c);
    const known = catalog ? new Set(Object.keys(catalog)) : null;
    const records: {
      screen: string;
      version: string;
      components: string[];
      stale: boolean;
      staleComponents: string[];
    }[] = [];
    for (const screen of await store.listScreens()) {
      const latest = (await store.listVersions(screen.id)).at(-1);
      if (latest === undefined) continue;
      const spec = await store.getVersion(screen.id, latest);
      if (!spec) continue;
      const missing = known ? staleComponents(spec, known) : [];
      records.push({
        screen: screen.name,
        version: `v${latest}`,
        components: componentTypesOf(spec),
        stale: missing.length > 0,
        staleComponents: missing,
      });
    }
    return c.json(records);
  });

  // A screen's metadata plus its version numbers.
  app.get('/screens/:id', async (c) => {
    const id = c.req.param('id');
    const store = await resolveStore(c);
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
    const store = await resolveStore(c);
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

    const catalog = await resolveCatalog(c);
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


  /**
   * The working draft (#166) — a MUTABLE spec the visual editor writes to.
   *
   * Versions stay immutable and meaningful (one per deliberate push); the draft absorbs the edits in
   * between, so live editing doesn't mint a version per keystroke. Catalog validation deliberately
   * does NOT run on a draft save: a half-built tree is a normal intermediate state while editing, and
   * refusing it would make the editor unusable. It runs on promote, which is the publishing act.
   */
  app.get('/screens/:id/draft', async (c) => {
    const id = c.req.param('id');
    const store = await resolveStore(c);
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    const spec = await store.getDraft(id);
    if (!spec) return c.json({ status: 'error', message: 'no draft' }, 404);
    return c.json({ spec });
  });

  app.put('/screens/:id/draft', async (c) => {
    const id = c.req.param('id');
    const store = await resolveStore(c);
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    const body = (await c.req.json().catch(() => null)) as { spec?: unknown } | null;
    if (!body || body.spec === undefined) {
      return c.json({ status: 'error', message: 'spec is required' }, 400);
    }
    try {
      const spec = await store.saveDraft(id, body.spec);
      return c.json({ spec });
    } catch (err) {
      if (err instanceof ZodError) {
        return c.json(
          { status: 'error', message: 'spec is not structurally valid', issues: err.issues },
          400,
        );
      }
      if (err instanceof ScreenNotFoundError) {
        return c.json({ status: 'error', message: err.message }, 404);
      }
      throw err;
    }
  });

  app.delete('/screens/:id/draft', async (c) => {
    const id = c.req.param('id');
    const store = await resolveStore(c);
    const discarded = await store.discardDraft(id);
    if (!discarded) return c.json({ status: 'error', message: 'no draft' }, 404);
    return c.json({ status: 'discarded' });
  });

  /**
   * Promote the draft to a new immutable version — the "push" in edit-freely-then-push.
   *
   * This IS the publishing act, so the catalog check happens here: a draft may be half-built, but a
   * version is something reviewers see and apps consume.
   */
  app.post('/screens/:id/draft/promote', async (c) => {
    const id = c.req.param('id');
    const store = await resolveStore(c);
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    const draft = await store.getDraft(id);
    if (!draft) return c.json({ status: 'error', message: 'no draft to promote' }, 404);

    const catalog = await resolveCatalog(c);
    if (!catalog) {
      return c.json(
        { status: 'error', message: 'no design-system catalog ingested yet; cannot validate a spec' },
        422,
      );
    }
    const issues = validateAgainstCatalog(draft, catalog);
    if (issues.length > 0) {
      return c.json({ status: 'error', message: 'spec does not match the catalog', issues }, 400);
    }

    try {
      const version = await store.promoteDraft(id);
      return c.json({ version }, 201);
    } catch (err) {
      if (err instanceof ScreenNotFoundError) {
        return c.json({ status: 'error', message: err.message }, 404);
      }
      if (err instanceof ScreenEmptyError) {
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
    const store = await resolveStore(c);
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

  // Read a screen's INTENT.md (null when none authored yet).
  app.get('/screens/:id/intent', async (c) => {
    const id = c.req.param('id');
    const store = await resolveStore(c);
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    return c.json({ intent: await store.getIntent(id) });
  });

  // Author / replace a screen's INTENT.md. Stored in the screen's git dir so it exports with it (#32).
  app.put('/screens/:id/intent', async (c) => {
    const id = c.req.param('id');
    const body = (await c.req.json().catch(() => null)) as { intent?: unknown } | null;
    const intent = body?.intent;
    if (typeof intent !== 'string') {
      return c.json({ status: 'error', message: 'intent (string) is required' }, 400);
    }
    const store = await resolveStore(c);
    try {
      await store.setIntent(id, intent);
      return c.json({ intent });
    } catch (err) {
      if (err instanceof ScreenNotFoundError) {
        return c.json({ status: 'error', message: err.message }, 404);
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
    const store = await resolveStore(c);
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
