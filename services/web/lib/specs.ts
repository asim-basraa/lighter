import { apiBaseUrl } from './inventory.js';
import type { SpecRecord } from './usage.js';

/** Saved specs plus a load error, if any — mirrors `LoadedInventory` so pages degrade consistently. */
export interface LoadedSpecs {
  specs: SpecRecord[];
  error: string | null;
}

/** A zero-arg request to the specs endpoint, returning a `fetch`-style Response. */
export type SpecsFetcher = () => Response | Promise<Response>;

/** The default production fetcher: `GET {LIGHTER_API_URL}/specs`, uncached (usage must be current). */
export function apiSpecsFetcher(baseUrl: string = apiBaseUrl()): SpecsFetcher {
  return () => fetch(new URL('/specs', baseUrl), { cache: 'no-store' });
}

/**
 * Load the saved specs the usage view derives blast-radius from. The API's `GET /specs` returns one
 * record per screen's latest version ({ screen, version, components }); the view groups them by
 * component. Any failure is folded into `error` (never thrown) so the page degrades to a message
 * instead of crashing — the same contract as `loadInventory`. An empty result renders the view's
 * "no saved specs yet" state.
 */
export async function loadSpecs(fetcher: SpecsFetcher = apiSpecsFetcher()): Promise<LoadedSpecs> {
  try {
    const res = await fetcher();
    if (!res.ok) {
      throw new Error(`Specs API returned ${res.status}`);
    }
    return { specs: (await res.json()) as SpecRecord[], error: null };
  } catch (err) {
    return { specs: [], error: err instanceof Error ? err.message : 'Failed to load specs' };
  }
}
