import type { SpecRecord } from './usage.js';

/**
 * Load the saved specs the usage view derives blast-radius from.
 *
 * Spec persistence + versioning is a later slice (#13–16); the API does not serve saved specs yet.
 * Until it does, this returns an empty set — so the usage view correctly shows every component as
 * "not yet used in any saved spec" rather than inventing data. When the specs endpoint lands, fetch
 * and normalize it here (screen, version, referenced component names) with no change to the view.
 */
export async function loadSpecs(): Promise<SpecRecord[]> {
  return [];
}
