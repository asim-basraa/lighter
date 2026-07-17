import { serve } from '@hono/node-server';
import { createClient, configFromEnv, runMigrations } from '@lighter/db';
import { createApp } from './app.js';
import { SpecStore } from './specStore.js';

/* c8 ignore start -- process entrypoint, behavior covered via createApp in app.test.ts */
const { sqlite, db } = createClient(configFromEnv());
runMigrations(sqlite);

// Screens + spec versions live in a git repo at SPECS_DIR (default ./.lighter-specs).
const specStore = new SpecStore(process.env.SPECS_DIR ?? '.lighter-specs');
await specStore.init();

const app = createApp({ db, specStore });
const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Lighter API listening on http://localhost:${info.port}`);
});
/* c8 ignore stop */
