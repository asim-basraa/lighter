import type { CSSProperties } from 'react';
import type { HealthFinding } from '../lib/inventory.js';
import { findingsByTarget, healthSummary, KIND_LABEL } from '../lib/health.js';

/**
 * The health panel: a summary of how many items are unhealthy plus the findings themselves, grouped
 * by the component or token they concern. A clean system renders an explicit healthy state rather
 * than an empty page.
 */
export function HealthPanel({ findings }: { findings: HealthFinding[] }) {
  const summary = healthSummary(findings);

  if (summary.healthy) {
    return (
      <p role="status" style={{ ...banner, ...healthyBanner }}>
        ✓ All healthy — no findings across the design system.
      </p>
    );
  }

  const groups = [...findingsByTarget(findings).entries()];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <p role="status" style={{ ...banner, ...warnBanner }}>
        <strong>{summary.affected}</strong> unhealthy {summary.affected === 1 ? 'item' : 'items'} ·{' '}
        <strong>{summary.total}</strong> {summary.total === 1 ? 'finding' : 'findings'} (
        {(Object.keys(summary.byKind) as (keyof typeof summary.byKind)[])
          .filter((kind) => summary.byKind[kind] > 0)
          .map((kind) => `${summary.byKind[kind]} ${KIND_LABEL[kind].toLowerCase()}`)
          .join(', ')}
        )
      </p>

      <ul style={list}>
        {groups.map(([target, targetFindings]) => (
          <li key={target} style={group}>
            <h2 style={groupTitle}>{target}</h2>
            <ul style={findingList}>
              {targetFindings.map((finding, i) => (
                <li key={`${finding.kind}-${i}`} style={findingRow}>
                  <span style={kindTag}>{KIND_LABEL[finding.kind]}</span>
                  <span style={message}>{finding.message}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

const banner: CSSProperties = {
  margin: 0,
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--fontSize-sm)',
};

const healthyBanner: CSSProperties = {
  background: 'var(--color-green-100)',
  color: 'var(--color-green-700)',
};

const warnBanner: CSSProperties = {
  background: 'var(--color-red-100)',
  color: 'var(--color-red-700)',
};

const list: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const group: CSSProperties = {
  background: 'var(--color-neutral-50)',
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-4)',
};

const groupTitle: CSSProperties = {
  margin: '0 0 var(--space-2) 0',
  fontSize: 'var(--fontSize-md)',
  color: 'var(--color-neutral-900)',
};

const findingList: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };

const findingRow: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  alignItems: 'baseline',
  padding: '2px 0',
};

const kindTag: CSSProperties = {
  flexShrink: 0,
  fontSize: 'var(--fontSize-xs)',
  color: 'var(--color-red-700)',
  fontWeight: 600,
};

const message: CSSProperties = {
  fontSize: 'var(--fontSize-sm)',
  color: 'var(--color-neutral-700)',
};
