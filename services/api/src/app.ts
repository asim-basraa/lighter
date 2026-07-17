import { Hono } from 'hono';
import { listHealthChecks, saveInventory, latestInventory, type Db } from '@lighter/db';
import { ingest, type InventoryModel } from '@lighter/ingestion';
import type { SpecStore } from './specStore.js';
import { registerScreenRoutes } from './screens.js';

export interface AppDeps {
  db: Db;
  /** Git-backed store for screens + spec versions. When present, the /screens routes are mounted. */
  specStore?: SpecStore;
}

/**
 * Build the Lighter API app over its dependencies. Kept as a factory — not a module singleton — so
 * tests construct it over an in-memory DB (and a temp-dir spec store) and drive it via
 * `app.request()`. Later slices mount their routes here.
 */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  // Centralized error shaping at the factory seam, so every route slice returns a consistent body.
  app.onError((err, c) => c.json({ status: 'error', message: err.message }, 500));

  app.get('/health', async (c) => {
    // A real read proves the API can reach the database, not just that the process is up. If the DB
    // is unreachable, report a 503 so an orchestrator's readiness probe can act on it.
    try {
      const checks = await listHealthChecks(deps.db);
      return c.json({ status: 'ok', db: 'ok', healthChecks: checks.length });
    } catch (err) {
      return c.json({ status: 'degraded', db: 'error', message: (err as Error).message }, 503);
    }
  });

  // Trigger ingestion of a design-system repo and persist the resulting inventory snapshot.
  app.post('/ingest', async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      repoPath?: unknown;
      artifactDir?: unknown;
    } | null;
    const repoPath = body?.repoPath;
    if (typeof repoPath !== 'string' || repoPath.length === 0) {
      return c.json({ status: 'error', message: 'repoPath (string) is required' }, 400);
    }
    const artifactDir = typeof body?.artifactDir === 'string' ? body.artifactDir : undefined;
    // artifactDir is a plain build-dir name (e.g. "dist"); reject separators/traversal so it can't
    // redirect the read outside the repo.
    if (artifactDir !== undefined && /[\\/]|\.\./.test(artifactDir)) {
      return c.json(
        { status: 'error', message: 'artifactDir must be a plain directory name' },
        400,
      );
    }

    // SECURITY: repoPath is a client-supplied absolute path read from the server filesystem —
    // acceptable only because this ingest surface is not exposed to untrusted callers. If it is ever
    // exposed, constrain repoPath to an allowlisted base directory (resolve + verify it stays under a
    // configured root). This hardening was previously tracked under #35 (internal SSO); SSO is no
    // longer planned, so it needs its own ticket if/when the surface is exposed — it does not ride
    // along with auth.
    let model: InventoryModel;
    try {
      model = ingest(repoPath, artifactDir ? { artifactDir } : {});
    } catch (err) {
      // A bad repo path / malformed artifacts is a client input problem, not a server fault.
      return c.json({ status: 'error', message: (err as Error).message }, 422);
    }

    await saveInventory(deps.db, model);
    return c.json({ status: 'ok', model }, 201);
  });

  // Serve the most recently ingested inventory model (the dashboard reads this).
  app.get('/inventory', async (c) => {
    const model = await latestInventory(deps.db);
    if (!model) {
      return c.json({ status: 'error', message: 'no inventory ingested yet' }, 404);
    }
    return c.json(model);
  });

  // Screen + spec-version CRUD (git-backed), mounted only when a spec store is configured.
  if (deps.specStore) {
    registerScreenRoutes(app, deps.specStore);
  }

  return app;
}
