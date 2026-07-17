import type { Hono } from 'hono';
import { createShare, resolveShare, type Db } from '@lighter/db';
import type { SpecStore } from './specStore.js';

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
export function registerShareRoutes(app: Hono, db: Db, store: SpecStore): void {
  // Deploy a specific version to a share URL. Idempotent per version (a version has one stable token).
  app.post('/screens/:id/versions/:version/share', async (c) => {
    const id = c.req.param('id');
    const version = Number(c.req.param('version'));
    if (!Number.isInteger(version) || version < 1) {
      return c.json({ status: 'error', message: 'version must be a positive integer' }, 400);
    }
    // Only mint a token for a version that actually exists, so a share URL never 404s at render time
    // for a version that was never saved.
    if (!(await store.getVersion(id, version))) {
      return c.json(
        { status: 'error', message: `screen "${id}" version ${version} not found` },
        404,
      );
    }
    const { token } = await createShare(db, id, version);
    return c.json({ token }, 201);
  });

  // Resolve a share token to the version it points at and return the spec to render. No auth: the
  // token is the credential. Unknown token, or a version since gone, is a 404.
  app.get('/share/:token', async (c) => {
    const token = c.req.param('token');
    const target = await resolveShare(db, token);
    if (!target) {
      return c.json({ status: 'error', message: 'share not found' }, 404);
    }
    const [screen, spec] = await Promise.all([
      store.getScreen(target.screenId),
      store.getVersion(target.screenId, target.version),
    ]);
    if (!screen || !spec) {
      return c.json({ status: 'error', message: 'share not found' }, 404);
    }
    return c.json({ screen, version: target.version, spec });
  });
}
