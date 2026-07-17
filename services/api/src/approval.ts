import type { Context, Hono } from 'hono';
import {
  getVersionState,
  setVersionState,
  getSignOffSet,
  setSignOffSet,
  recordSignOff,
  listSignOffs,
  type Db,
  type SignOffPartyInput,
} from '@lighter/db';
import type { SpecStore } from './specStore.js';
import {
  canTransition,
  isApprovalState,
  DEFAULT_STATE,
  type ApprovalState,
} from './approvalState.js';
import { validateSignOffSet, missingSignOffs } from './signOff.js';
import { safeNotify, type Notifier } from './notifier.js';

/**
 * Mount the per-version approval routes (#25) and sign-off enforcement (#26). State is
 * `draft → shared → changes-requested → approved` with enforced transitions; a version with no stored
 * state is `draft`. Deploying a version (a share, #21) advances draft → shared. Registered only when a
 * spec store is configured.
 *
 *   GET  /screens/:id/versions/:version/status           — current state
 *   POST /screens/:id/versions/:version/request-changes  — shared → changes-requested
 *   POST /screens/:id/versions/:version/approve          — → approved (gated by the sign-off set)
 *   GET  /screens/:id/sign-off-set                       — the configured required parties
 *   PUT  /screens/:id/sign-off-set                       — configure them (≥1 customer, ≥1 internal)
 *   POST /screens/:id/versions/:version/sign-offs        — a party signs off a version
 *
 * `approve` only reaches `approved` once every configured sign-off party has signed the version (#26).
 * A screen with no configured set is ungated (backward-compatible with #25).
 */
export function registerApprovalRoutes(
  app: Hono,
  db: Db,
  store: SpecStore,
  notifier?: Notifier,
): void {
  const parseVersion = (raw: string): number | null => {
    const v = Number(raw);
    return Number.isInteger(v) && v >= 1 ? v : null;
  };

  const currentState = async (screenId: string, version: number): Promise<ApprovalState> => {
    const stored = await getVersionState(db, screenId, version);
    return stored && isApprovalState(stored) ? stored : DEFAULT_STATE;
  };

  // Block approval until every configured sign-off party has signed this version. No set → ungated.
  const signOffGate = async (
    c: Context,
    screenId: string,
    version: number,
  ): Promise<Response | null> => {
    const required = await getSignOffSet(db, screenId);
    if (required.length === 0) return null;
    const missing = missingSignOffs(required, await listSignOffs(db, screenId, version));
    if (missing.length > 0) {
      return c.json({ status: 'error', message: 'sign-off incomplete', missing }, 409);
    }
    return null;
  };

  app.get('/screens/:id/versions/:version/status', async (c) => {
    const id = c.req.param('id');
    const version = parseVersion(c.req.param('version'));
    if (version === null) {
      return c.json({ status: 'error', message: 'version must be a positive integer' }, 400);
    }
    if (!(await store.getVersion(id, version))) {
      return c.json({ status: 'error', message: 'version not found' }, 404);
    }
    return c.json({ version, state: await currentState(id, version) });
  });

  // A transition endpoint: move a version to `to`, rejecting an illegal transition with 409. The
  // read-check-write here is not atomic; like the rest of the API it assumes a single writing process
  // (see SpecStore) — two racing transitions on one version could interleave into a lost update. A
  // conditional write (UPDATE … WHERE state = expected) would close that if we ever go multi-writer.
  type Precondition = (c: Context, id: string, version: number) => Promise<Response | null>;
  // Best-effort side effect after a committed transition. MUST NOT throw — it runs after the state is
  // already persisted, so a throw would surface a misleading 500 on a succeeded transition.
  type OnSuccess = (id: string, version: number) => Promise<void>;
  const transition = (
    path: string,
    to: ApprovalState,
    opts: { precondition?: Precondition; onSuccess?: OnSuccess } = {},
  ) =>
    app.post(path, async (c) => {
      const id = c.req.param('id') ?? '';
      const version = parseVersion(c.req.param('version') ?? '');
      if (version === null) {
        return c.json({ status: 'error', message: 'version must be a positive integer' }, 400);
      }
      if (!(await store.getVersion(id, version))) {
        return c.json({ status: 'error', message: 'version not found' }, 404);
      }
      const from = await currentState(id, version);
      if (from === to) {
        return c.json({ version, state: to }); // idempotent: already in the target state
      }
      if (!canTransition(from, to)) {
        return c.json(
          { status: 'error', message: `cannot go from "${from}" to "${to}"`, state: from },
          409,
        );
      }
      if (opts.precondition) {
        const blocked = await opts.precondition(c, id, version);
        if (blocked) return blocked;
      }
      await setVersionState(db, id, version, to);
      if (opts.onSuccess) await opts.onSuccess(id, version);
      return c.json({ version, state: to });
    });

  transition('/screens/:id/versions/:version/request-changes', 'changes-requested');
  transition('/screens/:id/versions/:version/approve', 'approved', {
    precondition: signOffGate,
    // Notify the team on approval — only fires when a version actually transitions to approved.
    onSuccess: (id, version) => safeNotify(notifier, { kind: 'approval', screenId: id, version }),
  });

  // Read the configured required sign-off parties for a screen.
  app.get('/screens/:id/sign-off-set', async (c) => {
    const id = c.req.param('id');
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    return c.json({ parties: await getSignOffSet(db, id) });
  });

  // Configure the required sign-off set (must include ≥1 customer and ≥1 internal owner).
  app.put('/screens/:id/sign-off-set', async (c) => {
    const id = c.req.param('id');
    if (!(await store.getScreen(id))) {
      return c.json({ status: 'error', message: `screen "${id}" not found` }, 404);
    }
    const body = (await c.req.json().catch(() => null)) as { parties?: unknown } | null;
    const parties = body?.parties;
    if (!Array.isArray(parties)) {
      return c.json({ status: 'error', message: 'parties (array) is required' }, 400);
    }
    const check = validateSignOffSet(parties);
    if (!check.ok) {
      return c.json({ status: 'error', message: check.message }, 400);
    }
    // Validated above, so the cast is sound.
    const typed = parties as SignOffPartyInput[];
    await setSignOffSet(
      db,
      id,
      typed.map((p) => ({ party: p.party, role: p.role })),
    );
    return c.json({ parties: await getSignOffSet(db, id) });
  });

  // Record a party's sign-off on a version. The party must belong to the screen's configured set.
  app.post('/screens/:id/versions/:version/sign-offs', async (c) => {
    const id = c.req.param('id');
    const version = parseVersion(c.req.param('version'));
    if (version === null) {
      return c.json({ status: 'error', message: 'version must be a positive integer' }, 400);
    }
    if (!(await store.getVersion(id, version))) {
      return c.json({ status: 'error', message: 'version not found' }, 404);
    }
    const body = (await c.req.json().catch(() => null)) as { party?: unknown } | null;
    const party = body?.party;
    if (typeof party !== 'string' || party.trim().length === 0) {
      return c.json({ status: 'error', message: 'party (non-empty string) is required' }, 400);
    }
    const required = await getSignOffSet(db, id);
    if (required.length === 0) {
      return c.json(
        { status: 'error', message: 'no sign-off set configured for this screen' },
        400,
      );
    }
    if (!required.some((r) => r.party === party)) {
      return c.json({ status: 'error', message: `"${party}" is not in the sign-off set` }, 400);
    }
    await recordSignOff(db, id, version, party);
    const signed = await listSignOffs(db, id, version);
    const missing = missingSignOffs(required, signed);
    return c.json({ version, party, signed, missing, complete: missing.length === 0 });
  });
}
