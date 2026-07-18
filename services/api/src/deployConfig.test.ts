import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, runMigrations, createProject, mintToken } from '@lighter/db';
import { createApp } from './app.js';

/**
 * Deploy config (#93): the cloud image runs SQLite from a file on the mounted volume
 * (DATABASE_URL=/data/lighter.db), not `:memory:`. This exercises that on-disk boot path — migrations
 * apply to a real file, the app serves /health, and the authed surface works — so a regression that
 * only shows up with a file-backed DB is caught before it reaches Railway.
 */
const dirs: string[] = [];
function fileDb() {
  const dir = mkdtempSync(join(tmpdir(), 'lighter-deploy-'));
  dirs.push(dir);
  const { sqlite, db } = createClient({ dialect: 'sqlite', url: join(dir, 'lighter.db') });
  runMigrations(sqlite);
  return db;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('deploy config — file-backed SQLite boot (#93)', () => {
  it('serves /health against an on-disk database', async () => {
    const app = createApp({ db: fileDb() });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect((await res.json()) as { db: string }).toMatchObject({ status: 'ok', db: 'ok' });
  });

  it('persists projects + tokens to the file DB and authenticates against them', async () => {
    const db = fileDb();
    const app = createApp({ db, auth: { db } });
    await createProject(db, { name: 'Acme', id: 'acme' });
    const { token } = await mintToken(db, 'acme');
    const res = await app.request('/projects/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });
});
