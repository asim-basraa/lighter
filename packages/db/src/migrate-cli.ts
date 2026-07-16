import { createClient, configFromEnv } from './client.js';
import { runMigrations } from './migrate.js';

/** `pnpm db:migrate` — apply migrations against the database configured by the environment. */
function main(): void {
  const config = configFromEnv();
  if (config.url === ':memory:') {
    console.warn(
      'DATABASE_URL is unset; migrating an in-memory database is a no-op. Set it in .env.',
    );
  }
  const { sqlite } = createClient(config);
  const applied = runMigrations(sqlite);
  sqlite.close();
  console.log(`Applied ${applied.length} migration(s) to ${config.dialect}:${config.url}`);
}

main();
