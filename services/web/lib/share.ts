import type { Spec } from '@lighter/spec';
import { apiBaseUrl } from './inventory.js';

/** A deployed mock: the screen it belongs to, the version, and the spec to render. */
export interface SharedVersion {
  screen: { id: string; name: string };
  version: number;
  spec: Spec;
}

/** The shared version plus a load error, if any — mirrors `LoadedInventory` so the page degrades. */
export interface LoadedShare {
  share: SharedVersion | null;
  error: string | null;
}

/** A zero-arg request to the share endpoint, returning a `fetch`-style Response. */
export type ShareFetcher = () => Response | Promise<Response>;

/** The default production fetcher: `GET {LIGHTER_API_URL}/share/:token`, uncached. */
export function apiShareFetcher(token: string, baseUrl: string = apiBaseUrl()): ShareFetcher {
  return () =>
    fetch(new URL(`/share/${encodeURIComponent(token)}`, baseUrl), { cache: 'no-store' });
}

/**
 * Load a deployed mock by its share token. A 404 (unknown or expired token) becomes a "not found"
 * error rather than a thrown exception, so the public share page renders a clean message instead of
 * crashing; any other failure is folded into `error` the same way.
 */
export async function loadShare(
  token: string,
  fetcher: ShareFetcher = apiShareFetcher(token),
): Promise<LoadedShare> {
  try {
    const res = await fetcher();
    if (res.status === 404) {
      return { share: null, error: 'This shared mock was not found. The link may be invalid.' };
    }
    if (!res.ok) {
      throw new Error(`Share API returned ${res.status}`);
    }
    return { share: (await res.json()) as SharedVersion, error: null };
  } catch (err) {
    return {
      share: null,
      error: err instanceof Error ? err.message : 'Failed to load shared mock',
    };
  }
}
