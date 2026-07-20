import type { CSSProperties } from 'react';
import Link from 'next/link';
import { DashboardView } from '../../../components/DashboardView.js';
import {
  listScreens,
  getScreen,
  getVersionState,
  type ApprovalState,
} from '../../../lib/screens.js';

/**
 * The screens list (#156): every screen in the project with its version count and the approval state
 * of its latest version — the entry point for amending a screen and sending it for review.
 */
export const dynamic = 'force-dynamic';

const STATE_TONE: Record<ApprovalState, { bg: string; fg: string }> = {
  draft: { bg: 'var(--muted-default, #f1f5f9)', fg: 'var(--foreground-muted, #64748b)' },
  shared: { bg: 'var(--primary-subtle, #eff6ff)', fg: 'var(--primary-default, #2563eb)' },
  'changes-requested': { bg: 'var(--warning-subtle, #fffbeb)', fg: '#b45309' },
  approved: { bg: 'var(--success-subtle, #f0fdf4)', fg: '#15803d' },
};

export default async function ScreensPage() {
  const screens = await listScreens();
  const rows = await Promise.all(
    screens.map(async (s) => {
      const detail = await getScreen(s.id);
      const latest = detail?.versions.at(-1);
      const state = latest ? await getVersionState(s.id, latest) : null;
      return { ...s, versions: detail?.versions ?? [], latest, state };
    }),
  );

  return (
    <DashboardView title="Screens" error={null}>
      {rows.length === 0 ? (
        <p style={muted}>
          No screens yet. Create one with the CLI (<code>lighter screen create</code>) or the API,
          then amend and deploy it here.
        </p>
      ) : (
        <ul style={list}>
          {rows.map((r) => (
            // The preview link is a SIBLING of the row link, not nested inside it — an <a> inside an
            // <a> is invalid HTML and browsers recover from it unpredictably.
            <li key={r.id} style={rowWrap}>
              <Link href={`/screens/${encodeURIComponent(r.id)}`} style={row} data-screen={r.id}>
                <span style={nameCol}>
                  <strong>{r.name}</strong>
                  <span style={muted}> · {r.id}</span>
                </span>
                <span style={muted}>
                  {r.versions.length} version{r.versions.length === 1 ? '' : 's'}
                </span>
                {r.state && (
                  <span
                    style={{
                      ...badge,
                      background: STATE_TONE[r.state].bg,
                      color: STATE_TONE[r.state].fg,
                    }}
                  >
                    {r.state}
                  </span>
                )}
              </Link>
              {r.latest && (
                <Link
                  href={`/screens/${encodeURIComponent(r.id)}/preview?v=${r.latest}`}
                  style={previewLink}
                  target="_blank"
                  aria-label={`Preview ${r.name} v${r.latest}`}
                >
                  Preview ↗
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </DashboardView>
  );
}

const list: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};
const row: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  padding: 'var(--space-3) var(--space-4)',
  border: '1px solid var(--border-default, #e4e4e7)',
  borderRadius: 'var(--radius-md)',
  textDecoration: 'none',
  color: 'inherit',
};
/** Row link takes the space; the preview link sits beside it without stretching. */
const rowWrap: CSSProperties = { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' };
const previewLink: CSSProperties = {
  flexShrink: 0,
  padding: 'var(--space-3) var(--space-3)',
  border: '1px solid var(--border-default, #e4e4e7)',
  borderRadius: 'var(--radius-md)',
  textDecoration: 'none',
  color: 'var(--primary-default, #2563eb)',
  fontSize: 'var(--fontSize-sm)',
  whiteSpace: 'nowrap',
};
const nameCol: CSSProperties = { flex: 1 };
const badge: CSSProperties = {
  borderRadius: 999,
  padding: '0.1rem 0.6rem',
  fontSize: 'var(--fontSize-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
};
const muted: CSSProperties = {
  color: 'var(--foreground-muted, #64748b)',
  fontSize: 'var(--fontSize-sm)',
};
