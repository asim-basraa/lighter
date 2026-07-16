import { serve } from '@hono/node-server';
import { createClient, configFromEnv, runMigrations } from '@lighter/db';
import { createApp } from './app.js';

/* c8 ignore start -- process entrypoint, behavior covered via createApp in app.test.ts */
const { sqlite, db } = createClient(configFromEnv());
runMigrations(sqlite);

const app = createApp({ db });
const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Lighter API listening on http://localhost:${info.port}`);
});
/* c8 ignore stop */
