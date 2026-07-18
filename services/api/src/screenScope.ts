import type { Context } from 'hono';
import type { SpecStore } from './specStore.js';

/** A screen resolved from a DB key: the store that holds it, its bare screen id, and its project. */
export interface ResolvedScreen {
  store: SpecStore;
  screenId: string;
  /** The owning project id, or null in global/single-tenant mode. Used to namespace sibling keys. */
  projectId: string | null;
}

/**
 * How a request maps to storage + a DB key (#87 scoping). Two implementations, chosen by `createApp`:
 *
 *  - **global**: one shared store; the DB key IS the bare screen id (single-tenant; behavior unchanged).
 *  - **scoped**: the caller's project store; the DB key is `<projectId>:<screenId>`. Because every
 *    review table (shares, comments, version_status, sign_offs, flow_links) is keyed by that string,
 *    namespacing it isolates projects with NO schema change — and a public share token recovers the
 *    project by splitting its stored key back apart.
 *
 * Screen ids and project ids are dash-slugs (no `:`), so `<projectId>:<screenId>` splits unambiguously
 * at the first colon.
 */
export interface ScreenScope {
  /** The store for the authed caller (project store, or the single global store). */
  storeFor(c: Context): Promise<SpecStore>;
  /** The DB key for a screen id in the authed caller's scope (namespaced per project, or bare). */
  keyFor(c: Context, screenId: string): string;
  /** The authed caller's project id, or null in global mode (for reads keyed by project, e.g. inventory). */
  projectIdFor(c: Context): string | null;
  /** Resolve a stored DB key (e.g. from a share token) back to its store + bare screen id, or null. */
  resolveKey(key: string): Promise<ResolvedScreen | null>;
}
