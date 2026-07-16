import { Hono } from 'hono';
import { listHealthChecks, saveInventory, latestInventory, type Db } from '@lighter/db';
import { ingest } from '@lighter/ingestion';

export interface AppDeps {
  db: Db;
}

/**
 * Build the Lighter API app over its dependencies (currently just the database). Kept as a factory
 * — not a module singleton — so tests construct it over an in-memory DB and drive it via
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

    let model;
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

  return app;
}
