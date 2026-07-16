import type { CSSProperties } from 'react';
import type { HealthFinding } from '../lib/inventory.js';
import { KIND_LABEL } from '../lib/health.js';

/**
 * A compact per-target health indicator. Green "Healthy" when a component (or token) has no
 * findings; otherwise a warning pill with the finding count and an accessible label naming the
 * kinds, so the signal isn't carried by colour alone.
 */
export function HealthBadge({ findings }: { findings: HealthFinding[] }) {
  if (findings.length === 0) {
    return (
      <span role="status" aria-label="Healthy" style={{ ...pill, ...healthy }}>
        ✓ Healthy
      </span>
    );
  }

  const kinds = [...new Set(findings.map((f) => KIND_LABEL[f.kind]))].join(', ');
  return (
    <span
      role="status"
      aria-label={`${findings.length} health ${findings.length === 1 ? 'issue' : 'issues'}: ${kinds}`}
      title={kinds}
      style={{ ...pill, ...warning }}
    >
      ⚠ <strong>{findings.length}</strong> {findings.length === 1 ? 'issue' : 'issues'}
    </span>
  );
}

const pill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px var(--space-2)',
  borderRadius: 'var(--radius-full)',
  fontSize: 'var(--fontSize-xs)',
  whiteSpace: 'nowrap',
};

const healthy: CSSProperties = {
  background: 'var(--color-green-100)',
  color: 'var(--color-green-700)',
};

const warning: CSSProperties = {
  background: 'var(--color-red-100)',
  color: 'var(--color-red-700)',
};
