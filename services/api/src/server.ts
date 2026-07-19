import { serve } from '@hono/node-server';
import { createClient, configFromEnv, runMigrations } from '@lighter/db';
import { AnthropicLlmClient } from '@lighter/generation';
import { createApp } from './app.js';
import { ProjectStores } from './projectStores.js';
import { bootstrapProject } from './bootstrap.js';
import { WebhookNotifier } from './notifier.js';
import { supabaseVerifierFromEnv } from './jwt.js';

/* c8 ignore start -- process entrypoint, behavior covered via createApp in app.test.ts */
const { sqlite, db } = createClient(configFromEnv());
runMigrations(sqlite);

// First-deploy usability: seed a project + API token when LIGHTER_BOOTSTRAP_PROJECT is set. The token
// is logged ONCE on creation (grab it from the deploy logs, then use it as LIGHTER_TOKEN in the CLI).
if (process.env.LIGHTER_BOOTSTRAP_PROJECT) {
  const seed = await bootstrapProject(
    db,
    process.env.LIGHTER_BOOTSTRAP_PROJECT,
    process.env.LIGHTER_TOKEN_SIGNING_SECRET,
  );
  console.log(
    seed.created
      ? `[bootstrap] project "${seed.project.id}" created — LIGHTER_TOKEN=${seed.token} (shown once; save it)`
      : `[bootstrap] project "${seed.project.id}" already exists`,
  );
}

// Multi-tenant: each project's screens + spec versions live in their own git repo under
// SPECS_DIR/<projectId> (default ./.lighter-specs). Stores initialize lazily per project on first use.
const storeProvider = new ProjectStores(process.env.SPECS_DIR ?? '.lighter-specs');

// Spec generation is enabled only when an Anthropic key is present (POST /generate makes real calls).
const specGenerator = process.env.ANTHROPIC_API_KEY ? new AnthropicLlmClient() : undefined;

// Comment/approval notifications go to NOTIFY_WEBHOOK_URL (Slack/Discord/tracker inbound) when set.
const notifier = process.env.NOTIFY_WEBHOOK_URL
  ? new WebhookNotifier(process.env.NOTIFY_WEBHOOK_URL)
  : undefined;

// The design-system re-ingest webhook (#36) needs BOTH a repo and a secret — it's internet-facing, so
// it's never served unauthenticated. A repo without a secret disables it (with a loud warning).
const designSystem =
  process.env.DESIGN_SYSTEM_REPO && process.env.WEBHOOK_SECRET
    ? {
        repoPath: process.env.DESIGN_SYSTEM_REPO,
        artifactDir: process.env.DESIGN_SYSTEM_ARTIFACT_DIR,
        webhookSecret: process.env.WEBHOOK_SECRET,
      }
    : undefined;
if (process.env.DESIGN_SYSTEM_REPO && !process.env.WEBHOOK_SECRET) {
  console.warn(
    'DESIGN_SYSTEM_REPO is set but WEBHOOK_SECRET is not — the re-ingest webhook is DISABLED (it requires a secret).',
  );
}

// Auth (#87 machine lane + #91 human lane). Project API tokens (CLI / GitHub Action) always work; the
// Supabase JWT lane (studio login + team management) mounts only when Supabase Auth env is present.
// The token signing secret must be stable in prod so minted tokens keep validating.
const jwtVerifier = supabaseVerifierFromEnv(process.env);
if (jwtVerifier) console.log('[auth] Supabase JWT lane enabled (studio login + team management)');
const auth = { db, tokenSecret: process.env.LIGHTER_TOKEN_SIGNING_SECRET, jwtVerifier };

const app = createApp({ db, storeProvider, specGenerator, notifier, designSystem, auth });
const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Lighter API listening on http://localhost:${info.port}`);
});
/* c8 ignore stop */
