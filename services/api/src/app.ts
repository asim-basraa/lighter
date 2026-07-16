import { Hono } from 'hono';
import { listHealthChecks, type Db } from '@lighter/db';

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

  return app;
}
