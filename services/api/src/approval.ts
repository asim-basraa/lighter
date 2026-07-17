import type { Hono } from 'hono';
import { getVersionState, setVersionState, type Db } from '@lighter/db';
import type { SpecStore } from './specStore.js';
import {
  canTransition,
  isApprovalState,
  DEFAULT_STATE,
  type ApprovalState,
} from './approvalState.js';

/**
 * Mount the per-version approval routes (#25). State is `draft → shared → changes-requested →
 * approved` with enforced transitions; a version with no stored state is `draft`. Deploying a version
 * (a share, #21) advances draft → shared. Registered only when a spec store is configured.
 *
 *   GET  /screens/:id/versions/:version/status           — current state
 *   POST /screens/:id/versions/:version/request-changes  — shared → changes-requested
 *   POST /screens/:id/versions/:version/approve          — shared|changes-requested → approved
 */
export function registerApprovalRoutes(app: Hono, db: Db, store: SpecStore): void {
  const parseVersion = (raw: string): number | null => {
    const v = Number(raw);
    return Number.isInteger(v) && v >= 1 ? v : null;
  };

  const currentState = async (screenId: string, version: number): Promise<ApprovalState> => {
    const stored = await getVersionState(db, screenId, version);
    return stored && isApprovalState(stored) ? stored : DEFAULT_STATE;
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

  // A transition endpoint: move a version to `to`, rejecting an illegal transition with 409.
  const transition = (path: string, to: ApprovalState) =>
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
      await setVersionState(db, id, version, to);
      return c.json({ version, state: to });
    });

  transition('/screens/:id/versions/:version/request-changes', 'changes-requested');
  transition('/screens/:id/versions/:version/approve', 'approved');
}
