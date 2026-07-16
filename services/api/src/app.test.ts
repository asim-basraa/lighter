import { describe, it, expect } from 'vitest';
import { createClient, runMigrations, insertHealthCheck } from '@lighter/db';
import { createApp } from './app.js';

interface HealthBody {
  status: string;
  db: string;
  healthChecks: number;
}

/**
 * API-level test harness: build the app over an in-memory migrated DB and drive it through
 * `app.request()` (a real fetch round-trip), never touching internals. This is the convention every
 * later API slice follows — external behavior is asserted through HTTP only.
 */
function testApp() {
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
  runMigrations(sqlite);
  return { app: createApp({ db }), db };
}

describe('API service', () => {
  it('GET /health returns ok and reflects the database state', async () => {
    const { app, db } = testApp();

    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthBody;
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(body.healthChecks).toBe(0);

    await insertHealthCheck(db, 'from test');
    const res2 = await app.request('/health');
    expect(((await res2.json()) as HealthBody).healthChecks).toBe(1);
  });

  it('returns 404 for an unknown route', async () => {
    const { app } = testApp();
    const res = await app.request('/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('shapes an uncaught error as a 500 via the onError seam', async () => {
    const { app } = testApp();
    // Mount a route that throws so the factory's app.onError seam is exercised end-to-end. The
    // existing /health path catches its own errors (503), so this is the only path that reaches
    // onError and asserts its consistent error body.
    app.get('/boom', () => {
      throw new Error('boom');
    });

    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    const body = (await res.json()) as { status: string; message: string };
    expect(body.status).toBe('error');
    expect(body.message).toBe('boom');
  });

  it('reports 503 degraded when the database is unreachable', async () => {
    const { sqlite, db } = createClient({ dialect: 'sqlite', url: ':memory:' });
    runMigrations(sqlite);
    const app = createApp({ db });
    sqlite.close(); // simulate an unreachable DB

    const res = await app.request('/health');
    expect(res.status).toBe(503);
    const body = (await res.json()) as HealthBody;
    expect(body.status).toBe('degraded');
    expect(body.db).toBe('error');
  });
});
