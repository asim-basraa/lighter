import type { CSSProperties } from 'react';
import { formatDeployedAt } from '../lib/deployedAt.js';

/**
 * The banner shown on top of every deployed mock: which screen + version this is, when it was
 * deployed, and a clear "prototype" signal so a reviewer never mistakes a shared mock for a shipped
 * product. Rendered as an ARIA `note` (informational, non-interactive) and fixed above the preview.
 */
export function VersionBanner({
  screenName,
  version,
  deployedAt,
}: {
  screenName: string;
  version: number;
  deployedAt: string;
}) {
  return (
    <div role="note" aria-label="Prototype version" style={banner}>
      <span style={tag}>Prototype</span>
      <span style={detail}>
        {screenName} · v{version} · {formatDeployedAt(deployedAt)}
      </span>
    </div>
  );
}

const banner: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-2) var(--space-4)',
  background: 'var(--color-neutral-900)',
  color: 'var(--color-neutral-50)',
  fontSize: 'var(--fontSize-sm)',
};

const tag: CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 700,
  fontSize: 'var(--fontSize-xs)',
  padding: '2px var(--space-2)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-amber-500, #f59e0b)',
  color: 'var(--color-neutral-900)',
};

const detail: CSSProperties = { opacity: 0.9 };
