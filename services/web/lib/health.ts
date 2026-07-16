import type { HealthFinding, HealthFindingKind } from './inventory.js';

/** A roll-up of the current health findings, for the dashboard summary. */
export interface HealthSummary {
  /** Total number of findings. */
  total: number;
  /** Distinct targets (components or tokens) with at least one finding. */
  affected: number;
  /** How many findings of each kind. */
  byKind: Record<HealthFindingKind, number>;
  /** True when there are no findings at all. */
  healthy: boolean;
}

const KINDS: HealthFindingKind[] = ['missing-description', 'missing-preview', 'orphaned-token'];

/** Finding kinds whose `target` is a component (not a token). */
const COMPONENT_KINDS: HealthFindingKind[] = ['missing-description', 'missing-preview'];

/** Human-readable labels for each finding kind. */
export const KIND_LABEL: Record<HealthFindingKind, string> = {
  'missing-description': 'Missing description',
  'missing-preview': 'Missing preview',
  'orphaned-token': 'Orphaned token',
};

/** Group findings by the component or token they concern. */
export function findingsByTarget(findings: HealthFinding[]): Map<string, HealthFinding[]> {
  const map = new Map<string, HealthFinding[]>();
  for (const finding of findings) {
    const bucket = map.get(finding.target);
    if (bucket) bucket.push(finding);
    else map.set(finding.target, [finding]);
  }
  return map;
}

/** The findings that concern a single target (e.g. one component). */
export function findingsFor(findings: HealthFinding[], target: string): HealthFinding[] {
  return findings.filter((finding) => finding.target === target);
}

/**
 * The findings for a specific component. Restricted to component-scoped kinds so a token-scoped
 * finding (`orphaned-token`) can never attach to a component card even if a token and a component
 * happened to share a name — correct by construction, not by naming convention.
 */
export function componentFindings(findings: HealthFinding[], component: string): HealthFinding[] {
  return findings.filter(
    (finding) => finding.target === component && COMPONENT_KINDS.includes(finding.kind),
  );
}

/** Summarize the findings: totals, affected count, and a per-kind breakdown. */
export function healthSummary(findings: HealthFinding[]): HealthSummary {
  const byKind = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<HealthFindingKind, number>;
  for (const finding of findings) {
    byKind[finding.kind] += 1;
  }
  return {
    total: findings.length,
    affected: findingsByTarget(findings).size,
    byKind,
    healthy: findings.length === 0,
  };
}
