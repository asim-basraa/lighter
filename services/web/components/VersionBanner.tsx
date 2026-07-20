import type { CSSProperties } from 'react';
import { formatDeployedAt } from '../lib/deployedAt.js';

/**
 * The banner shown on top of every rendered screen: which screen + version this is, and a clear
 * signal of what the reader is looking at, so a mock is never mistaken for a shipped product.
 * Rendered as an ARIA `note` (informational, non-interactive) and fixed above the preview.
 *
 * Two kinds, deliberately distinguished (#164):
 * - **deployed** — a shared mock, addressed by a share token, with its deploy date.
 * - **draft preview** — the author looking at a stored version in the studio. Nothing was deployed
 *   and no share link exists, so the date is meaningless and is replaced by that fact.
 */
export function VersionBanner({
  screenName,
  version,
  deployedAt,
}: {
  screenName: string;
  version: number;
  /** ISO deploy timestamp, or null for a studio draft preview that was never deployed. */
  deployedAt: string | null;
}) {
  const draft = deployedAt === null;
  return (
    <div role="note" aria-label={draft ? 'Draft preview' : 'Prototype version'} style={banner}>
      <span style={draft ? draftTag : tag}>{draft ? 'Draft preview' : 'Prototype'}</span>
      <span style={detail}>
        {screenName} · v{version} ·{' '}
        {draft ? 'not deployed — no review link' : formatDeployedAt(deployedAt)}
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

/** Blue, not amber: a draft preview is a normal authoring step, not a caution about a live artifact. */
const draftTag: CSSProperties = {
  ...tag,
  background: 'var(--primary-default, #2563eb)',
  color: 'var(--color-neutral-50)',
};

const detail: CSSProperties = { opacity: 0.9 };
