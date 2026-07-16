import type { CatalogArtifact, HealthFinding, InventoryToken } from './model.js';

/** Descriptions at or below this length are treated as effectively missing. */
const MIN_DESCRIPTION_LENGTH = 3;

/**
 * Derive health findings that make the catalog less agent-ready:
 *  - `missing-description`: a component with an empty/near-empty description.
 *  - `missing-preview`: a component absent from the catalog's `previews` list (only when provided).
 *  - `orphaned-token`: a token not referenced in `usedTokens` (only when provided).
 *
 * `previews`/`usedTokens` are optional in the artifact; when a repo omits them, the corresponding
 * check is skipped rather than flagging everything — absence of signal is not evidence of a problem.
 * Findings are returned sorted (kind, then target) for stable, diffable output.
 */
export function computeHealth(catalog: CatalogArtifact, tokens: InventoryToken[]): HealthFinding[] {
  const findings: HealthFinding[] = [];

  for (const [name, entry] of Object.entries(catalog.components)) {
    if (entry.description.trim().length <= MIN_DESCRIPTION_LENGTH) {
      findings.push({
        kind: 'missing-description',
        target: name,
        message: `Component "${name}" has no meaningful description.`,
      });
    }
  }

  if (catalog.previews) {
    const hasPreview = new Set(catalog.previews);
    for (const name of Object.keys(catalog.components)) {
      if (!hasPreview.has(name)) {
        findings.push({
          kind: 'missing-preview',
          target: name,
          message: `Component "${name}" has no preview spec.`,
        });
      }
    }
  }

  if (catalog.usedTokens) {
    const used = new Set(catalog.usedTokens);
    for (const token of tokens) {
      if (!used.has(token.name)) {
        findings.push({
          kind: 'orphaned-token',
          target: token.name,
          message: `Token "${token.name}" is not referenced by any component.`,
        });
      }
    }
  }

  return findings.sort((a, b) => a.kind.localeCompare(b.kind) || a.target.localeCompare(b.target));
}
