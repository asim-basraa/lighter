export type {
  InventoryModel,
  InventoryComponent,
  InventoryToken,
  HealthFinding,
  HealthFindingKind,
} from '@lighter/ingestion';
import type { InventoryModel } from '@lighter/ingestion';

/**
 * A zero-arg request to the inventory endpoint, returning a `fetch`-style Response. Both a Response
 * and a Promise of one are accepted so an in-process Hono `app.request` (sync-or-async) drops in
 * alongside the real `fetch`.
 */
export type InventoryFetcher = () => Response | Promise<Response>;

/**
 * Fetch the latest ingested inventory model from the Lighter API. Returns `null` when nothing has
 * been ingested yet (the API answers 404) so callers render an empty state instead of throwing.
 *
 * The fetcher is injected rather than hard-wired to `fetch` so the exact same code path runs in
 * tests (against an in-process Hono `app.request`) and in production (against the HTTP service).
 */
export async function fetchInventory(fetcher: InventoryFetcher): Promise<InventoryModel | null> {
  const res = await fetcher();
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Inventory API returned ${res.status}`);
  }
  return (await res.json()) as InventoryModel;
}

/** Base URL of the Lighter API, from `LIGHTER_API_URL` (defaults to the local dev service). */
export function apiBaseUrl(): string {
  return process.env.LIGHTER_API_URL ?? 'http://localhost:3000';
}

/**
 * The default production fetcher: `GET {LIGHTER_API_URL}/inventory`. `no-store` so the inventory is
 * re-read on every request rather than served from Next's data cache — the dashboard must reflect
 * the latest ingest.
 */
export function apiInventoryFetcher(baseUrl: string = apiBaseUrl()): InventoryFetcher {
  return () => fetch(new URL('/inventory', baseUrl), { cache: 'no-store' });
}

/** The inventory model plus a load error, if any — the shape every dashboard page renders from. */
export interface LoadedInventory {
  model: InventoryModel | null;
  error: string | null;
}

/**
 * Load the inventory for a dashboard page: fetch it and fold any failure into a plain `error` string
 * so a server component can degrade to a message instead of throwing. A `null` model means nothing
 * has been ingested yet (an empty state), distinct from `error` (the API was unreachable).
 */
export async function loadInventory(
  fetcher: InventoryFetcher = apiInventoryFetcher(),
): Promise<LoadedInventory> {
  try {
    return { model: await fetchInventory(fetcher), error: null };
  } catch (err) {
    return { model: null, error: err instanceof Error ? err.message : 'Failed to load inventory' };
  }
}
