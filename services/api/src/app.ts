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

  app.get('/health', async (c) => {
    // A real read proves the API can reach the database, not just that the process is up.
    const checks = await listHealthChecks(deps.db);
    return c.json({ status: 'ok', db: 'ok', healthChecks: checks.length });
  });

  return app;
}
