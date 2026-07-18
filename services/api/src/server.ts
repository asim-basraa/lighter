import { serve } from '@hono/node-server';
import { createClient, configFromEnv, runMigrations } from '@lighter/db';
import { AnthropicLlmClient } from '@lighter/generation';
import { createApp } from './app.js';
import { SpecStore } from './specStore.js';
import { WebhookNotifier } from './notifier.js';

/* c8 ignore start -- process entrypoint, behavior covered via createApp in app.test.ts */
const { sqlite, db } = createClient(configFromEnv());
runMigrations(sqlite);

// Screens + spec versions live in a git repo at SPECS_DIR (default ./.lighter-specs).
const specStore = new SpecStore(process.env.SPECS_DIR ?? '.lighter-specs');
await specStore.init();

// Spec generation is enabled only when an Anthropic key is present (POST /generate makes real calls).
const specGenerator = process.env.ANTHROPIC_API_KEY ? new AnthropicLlmClient() : undefined;

// Comment/approval notifications go to NOTIFY_WEBHOOK_URL (Slack/Discord/tracker inbound) when set.
const notifier = process.env.NOTIFY_WEBHOOK_URL
  ? new WebhookNotifier(process.env.NOTIFY_WEBHOOK_URL)
  : undefined;

// The design-system re-ingest webhook is enabled when DESIGN_SYSTEM_REPO is configured (#36).
const designSystem = process.env.DESIGN_SYSTEM_REPO
  ? {
      repoPath: process.env.DESIGN_SYSTEM_REPO,
      artifactDir: process.env.DESIGN_SYSTEM_ARTIFACT_DIR,
      webhookSecret: process.env.WEBHOOK_SECRET,
    }
  : undefined;

const app = createApp({ db, specStore, specGenerator, notifier, designSystem });
const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Lighter API listening on http://localhost:${info.port}`);
});
/* c8 ignore stop */
