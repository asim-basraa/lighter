import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Hono } from 'hono';
import { saveInventory, wasCommitIngested, recordIngestedCommit, type Db } from '@lighter/db';
import { ingest, type InventoryModel } from '@lighter/ingestion';

/** Configuration for the design-system re-ingest webhook (#36). */
export interface DesignSystemConfig {
  /** Absolute path to the design-system repo to re-ingest. SERVER-configured — never client-supplied. */
  repoPath: string;
  /** Build-artifact dir within the repo (e.g. "dist"). */
  artifactDir?: string;
  /**
   * HMAC secret — REQUIRED. This endpoint is internet-facing (a push provider calls it) and triggers
   * server work (filesystem read + DB writes), so every request must carry a valid `X-Hub-Signature-256`.
   * The webhook is only mounted when a secret is configured (see `createApp`); an unauthenticated
   * re-ingest trigger is never served.
   */
  webhookSecret: string;
}

/** Verify a GitHub-style `sha256=<hex>` HMAC over the raw body, in constant time. */
function verifySignature(secret: string, raw: string, header: string | undefined): boolean {
  if (!header) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Mount the design-system push webhook (#36): a push to the design-system repo triggers re-ingestion,
 * so the inventory tracks the repo without a manual sync. Idempotent per commit sha — a re-delivered
 * webhook for an already-processed commit is a no-op. The repo path is server-configured (not taken
 * from the payload), so this doesn't reopen the repoPath injection surface `/ingest` warns about.
 * Every request must carry a valid HMAC signature (the secret is required).
 *
 * NOTE: ingestion reads the repo's CURRENT on-disk state, not the pushed commit — the sha is only an
 * idempotency token. The deployment is responsible for updating the working copy to the pushed commit
 * BEFORE delivering the webhook (pull-then-notify); otherwise a delivery would ingest stale content
 * and record that commit as done.
 */
export function registerWebhookRoutes(app: Hono, db: Db, config: DesignSystemConfig): void {
  app.post('/webhooks/design-system', async (c) => {
    const raw = await c.req.text();

    // Reject any request without a valid signature — this endpoint is internet-facing.
    const sig = c.req.header('x-hub-signature-256');
    if (!verifySignature(config.webhookSecret, raw, sig)) {
      return c.json({ status: 'error', message: 'invalid signature' }, 401);
    }

    let payload: { after?: unknown; head_commit?: { id?: unknown } } | null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      return c.json({ status: 'error', message: 'invalid JSON payload' }, 400);
    }
    // The commit sha is the idempotency key. GitHub push payloads carry `after` (and head_commit.id).
    const sha =
      typeof payload?.after === 'string'
        ? payload.after
        : typeof payload?.head_commit?.id === 'string'
          ? payload.head_commit.id
          : null;
    if (!sha) {
      return c.json({ status: 'error', message: 'payload missing a commit sha' }, 400);
    }

    // Idempotent on repeated deliveries: a commit we've already ingested is a no-op.
    if (await wasCommitIngested(db, sha)) {
      return c.json({ status: 'skipped', reason: 'commit already ingested', commit: sha });
    }

    let model: InventoryModel;
    try {
      model = ingest(
        config.repoPath,
        config.artifactDir ? { artifactDir: config.artifactDir } : {},
      );
    } catch (err) {
      // A bad repo / malformed artifacts is a configuration/content problem, not a server fault. Log
      // the detail (it embeds server paths) but return a generic message to the caller.
      console.error('design-system re-ingest failed:', err);
      return c.json({ status: 'error', message: 'ingestion failed' }, 422);
    }
    await saveInventory(db, model);
    await recordIngestedCommit(db, sha);
    return c.json({ status: 'ok', commit: sha }, 201);
  });
}
