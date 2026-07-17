import type { SpecRecord } from './usage.js';

/** Saved specs plus a load error, if any — mirrors `LoadedInventory` so pages degrade consistently. */
export interface LoadedSpecs {
  specs: SpecRecord[];
  error: string | null;
}

/**
 * Load the saved specs the usage view derives blast-radius from.
 *
 * Spec persistence + versioning is a later slice (#13–16); the API does not serve saved specs yet.
 * Until it does, this returns an empty set — so the usage view correctly shows "no specs yet" rather
 * than inventing data. When the specs endpoint lands, fetch and normalize it here (screen, version,
 * referenced component names) and FOLD any failure into `error` (do not throw) so the page keeps
 * degrading to a message instead of crashing the route — same contract as `loadInventory`.
 */
export async function loadSpecs(): Promise<LoadedSpecs> {
  return { specs: [], error: null };
}
