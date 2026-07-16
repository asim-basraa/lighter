/**
 * Component usage / blast-radius derivation.
 *
 * A saved spec is one screen at one version plus the component names it references. Given those, we
 * can answer "if I change component X, which screens and versions am I affecting?" — the maintainer's
 * blast-radius question.
 *
 * The spec MODEL (persistence + versioning) is a later slice (#13–16); this module owns only the
 * pure derivation over an already-normalized `SpecRecord[]`, so it can be built and tested now and
 * wired to the real specs source once that lands (see `lib/specs`).
 */
export interface SpecRecord {
  /** The screen this saved spec renders (e.g. "Checkout"). */
  screen: string;
  /** The spec version (e.g. "v2"). */
  version: string;
  /** The component names this screen version references. */
  components: string[];
}

/** A single place a component is used: one screen at one version. */
export interface UsageRef {
  screen: string;
  version: string;
}

/** The screens+versions that reference a component, deduplicated and sorted for stable output. */
export function usageFor(specs: SpecRecord[], component: string): UsageRef[] {
  const seen = new Set<string>();
  const refs: UsageRef[] = [];
  for (const spec of specs) {
    if (!spec.components.includes(component)) continue;
    const key = `${spec.screen}@${spec.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ screen: spec.screen, version: spec.version });
  }
  return refs.sort(
    (a, b) => a.screen.localeCompare(b.screen) || a.version.localeCompare(b.version),
  );
}

/** Blast-radius for each requested component: name → its referencing screens+versions (possibly empty). */
export function usageByComponent(
  specs: SpecRecord[],
  componentNames: string[],
): Map<string, UsageRef[]> {
  return new Map(componentNames.map((name) => [name, usageFor(specs, name)]));
}
