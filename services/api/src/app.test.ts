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
