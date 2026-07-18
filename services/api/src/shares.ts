import type { Hono } from 'hono';
import {
  createShare,
  resolveShare,
  getVersionState,
  setVersionState,
  getFlow,
  latestShareForScreen,
  type Db,
} from '@lighter/db';
import type { ScreenScope } from './screenScope.js';
import { DEFAULT_STATE, isApprovalState } from './approvalState.js';

/**
 * Mount the tokenized share routes. Registered only when a SpecStore is configured (a share points
 * at a stored spec version). Two routes:
 *
 *   POST /screens/:id/versions/:version/share  — deploy a version: mint (or reuse) its share token.
 *   GET  /share/:token                         — public read: resolve a token to the spec to render.
 *
 * The share token is the only credential to view a deployed mock — no account, no per-version build.
 * The GET is the "static renderer fetches spec by ID" seam: the web renderer fetches this and renders
 * the returned spec through the design system.
 *
 * SECURITY: the intended public surface is the web `/share/[token]` page, which proxies GET only. The
 * mint route (POST …/share) is unauthenticated and screen ids are guessable human slugs, so anyone
 * who can reach THIS API directly can enumerate versions and mint a token for any of them —
 * short-circuiting the token's unguessability. This is acceptable only because the API is not exposed
 * to untrusted callers (the same posture as `/ingest`; see app.ts). If the API is ever exposed,
 * minting must be gated (auth, or restrict token issuance to an internal caller) under the same
 * hardening ticket as the repoPath note.
 */
export function registerShareRoutes(app: Hono, db: Db, scope: ScreenScope): void {
  // Deploy a specific version to a share URL. Idempotent per version (a version has one stable token).
  app.post('/screens/:id/versions/:version/share', async (c) => {
    const id = c.req.param('id');
    const version = Number(c.req.param('version'));
    if (!Number.isInteger(version) || version < 1) {
      return c.json({ status: 'error', message: 'version must be a positive integer' }, 400);
    }
    const store = await scope.storeFor(c);
    const key = scope.keyFor(c, id);
    // Only mint a token for a version that actually exists, so a share URL never 404s at render time
    // for a version that was never saved.
    if (!(await store.getVersion(id, version))) {
      return c.json(
        { status: 'error', message: `screen "${id}" version ${version} not found` },
        404,
      );
    }
    // Optional expiry (#34): body `expiresInSeconds` → an absolute expiry timestamp. Omitted → no
    // expiry. Re-deploying updates it (createShare re-sets expiresAt on the stable token).
    const body = (await c.req.json().catch(() => null)) as { expiresInSeconds?: unknown } | null;
    const ttl = body?.expiresInSeconds;
    let expiresAt: string | null = null;
    if (ttl !== undefined && ttl !== null) {
      if (typeof ttl !== 'number' || !Number.isFinite(ttl)) {
        return c.json({ status: 'error', message: 'expiresInSeconds must be a number' }, 400);
      }
      const at = new Date(Date.now() + ttl * 1000);
      if (Number.isNaN(at.getTime())) {
        return c.json({ status: 'error', message: 'expiresInSeconds is out of range' }, 400);
      }
      expiresAt = at.toISOString();
    }
    const { token } = await createShare(db, key, version, expiresAt);
    // Deploying advances the approval lifecycle draft → shared (#25). Only from draft, so a re-deploy
    // never resets a version that's already shared / changes-requested / approved.
    const stored = await getVersionState(db, key, version);
    const current = stored && isApprovalState(stored) ? stored : DEFAULT_STATE;
    if (current === DEFAULT_STATE) {
      await setVersionState(db, key, version, 'shared');
    }
    return c.json({ token, expiresAt }, 201);
  });

  // Resolve a share token to the version it points at and return the spec to render. No auth: the
  // token is the credential. Unknown token, or a version since gone, is a 404.
  app.get('/share/:token', async (c) => {
    const token = c.req.param('token');
    const target = await resolveShare(db, token);
    if (!target) {
      return c.json({ status: 'error', message: 'share not found' }, 404);
    }
    // The share's stored screen key carries its scope; resolve it back to the owning store + screen id.
    const resolved = await scope.resolveKey(target.screenId);
    if (!resolved) {
      return c.json({ status: 'error', message: 'share not found' }, 404);
    }
    const { store, screenId } = resolved;
    const [screen, spec] = await Promise.all([
      store.getScreen(screenId),
      store.getVersion(screenId, target.version),
    ]);
    if (!screen || !spec) {
      return c.json({ status: 'error', message: 'share not found' }, 404);
    }
    // Resolve the screen's click-through flow (#30): each link → the current deployed mock of its
    // target screen (token null when the target has no deployed version, so the UI can disable it).
    const flow = await Promise.all(
      (await getFlow(db, target.screenId)).map(async (link) => ({
        label: link.label,
        targetScreenId: link.target,
        token: await latestShareForScreen(db, link.target),
      })),
    );
    // `deployedAt` (when the version was first shared) feeds the deployed mock's version banner.
    return c.json({ screen, version: target.version, spec, deployedAt: target.createdAt, flow });
  });
}
