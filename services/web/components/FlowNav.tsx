import type { CSSProperties } from 'react';
import type { FlowLink } from '../lib/share.js';

/**
 * Click-through flow navigation on a deployed mock (#30): a labelled link to each connected screen's
 * current deployed mock, so a reviewer can walk a multi-screen journey. A link whose target isn't
 * deployed yet (null token) renders as a disabled control rather than a dead link.
 */
export function FlowNav({ flow }: { flow: FlowLink[] }) {
  if (flow.length === 0) return null;
  return (
    <nav style={bar} aria-label="Prototype flow">
      <span style={caption}>Flow</span>
      {flow.map((link, i) =>
        link.token ? (
          <a key={i} href={`/share/${link.token}`} style={linkStyle}>
            {link.label} →
          </a>
        ) : (
          <span key={i} style={disabled} aria-disabled="true" title="Not deployed yet">
            {link.label}
          </span>
        ),
      )}
    </nav>
  );
}

const bar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-4)',
  background: 'var(--color-neutral-100)',
  borderBottom: '1px solid var(--color-neutral-300)',
  fontSize: 'var(--fontSize-sm)',
  flexWrap: 'wrap',
};

const caption: CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontSize: 'var(--fontSize-xs)',
  fontWeight: 700,
  color: 'var(--color-neutral-500)',
};

const linkStyle: CSSProperties = {
  color: 'var(--color-blue-700)',
  textDecoration: 'none',
  fontWeight: 600,
};

const disabled: CSSProperties = { color: 'var(--color-neutral-500)', cursor: 'not-allowed' };
