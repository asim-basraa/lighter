import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DashboardView } from '../../../../components/DashboardView.js';
import { ScreenEditor } from '../../../../components/ScreenEditor.js';
import {
  getScreen,
  getVersionSpec,
  getVersionState,
  getScreenComments,
} from '../../../../lib/screens.js';

/**
 * Screen detail (#156): version history, the selected version's spec, the amend/deploy/approve
 * actions, and the review comments gathered for that version. `?v=` selects a version (latest by
 * default) so you can read an older one — versions are immutable, so editing always forks a new one.
 */
export const dynamic = 'force-dynamic';

export default async function ScreenPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { v?: string };
}) {
  const screen = await getScreen(params.id);
  if (!screen) notFound();

  const versions = screen.versions;
  const requested = Number(searchParams.v);
  const version = versions.includes(requested) ? requested : (versions.at(-1) ?? 0);

  if (!version) {
    return (
      <DashboardView title={screen.name} error={null}>
        <p style={muted}>This screen has no versions yet — save a spec to create v1.</p>
      </DashboardView>
    );
  }

  const [specRes, state, comments] = await Promise.all([
    getVersionSpec(params.id, version),
    getVersionState(params.id, version),
    getScreenComments(params.id),
  ]);
  const forVersion = comments.find((c) => c.version === version);

  return (
    <DashboardView title={screen.name} error={null}>
      <p style={muted}>
        <Link href="/screens" style={link}>
          ← All screens
        </Link>{' '}
        · <code>{screen.id}</code>
      </p>

      <div style={versionRow}>
        <span style={muted}>Versions:</span>
        {versions.map((v) => (
          <Link
            key={v}
            href={`/screens/${encodeURIComponent(screen.id)}?v=${v}`}
            style={v === version ? versionCurrent : versionLink}
          >
            v{v}
          </Link>
        ))}
      </div>

      {specRes ? (
        <ScreenEditor
          screenId={screen.id}
          version={version}
          initialSpec={specRes.spec}
          state={state}
        />
      ) : (
        <p style={muted}>Could not load this version&apos;s spec.</p>
      )}

      <section style={{ marginTop: 'var(--space-6)' }}>
        <h2 style={heading}>Review comments — v{version}</h2>
        {!forVersion || forVersion.elements.length === 0 ? (
          <p style={muted}>
            No comments on this version yet. Deploy it and share the link to collect feedback.
          </p>
        ) : (
          <ul style={commentList}>
            {forVersion.elements.map((el) => (
              <li key={el.elementId} style={commentGroup}>
                <code style={anchor}>{el.elementId}</code>
                <ul style={threadList}>
                  {el.threads.map((t) => (
                    <li key={t.id}>
                      <strong>{t.author ?? 'Anonymous'}</strong>: {t.body}
                      {t.replies && t.replies.length > 0 && (
                        <ul style={threadList}>
                          {t.replies.map((r) => (
                            <li key={r.id}>
                              <strong>{r.author ?? 'Anonymous'}</strong>: {r.body}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardView>
  );
}

const muted: CSSProperties = {
  color: 'var(--foreground-muted, #64748b)',
  fontSize: 'var(--fontSize-sm)',
};
const link: CSSProperties = { color: 'var(--primary-default, #2563eb)', textDecoration: 'none' };
const versionRow: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  alignItems: 'center',
  margin: 'var(--space-2) 0 var(--space-4)',
  flexWrap: 'wrap',
};
const versionLink: CSSProperties = {
  padding: '0.1rem 0.5rem',
  borderRadius: 6,
  border: '1px solid var(--border-default, #e2e8f0)',
  textDecoration: 'none',
  color: 'inherit',
  fontSize: 'var(--fontSize-sm)',
};
const versionCurrent: CSSProperties = {
  ...versionLink,
  borderColor: 'var(--primary-default, #2563eb)',
  color: 'var(--primary-default, #2563eb)',
  fontWeight: 600,
};
const heading: CSSProperties = { fontSize: 'var(--fontSize-lg)', margin: '0 0 var(--space-2)' };
const commentList: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
};
const commentGroup: CSSProperties = {
  border: '1px solid var(--border-default, #e2e8f0)',
  borderRadius: 8,
  padding: 'var(--space-3)',
};
const anchor: CSSProperties = {
  color: 'var(--primary-default, #2563eb)',
  fontSize: 'var(--fontSize-sm)',
};
const threadList: CSSProperties = {
  margin: '0.35rem 0 0',
  paddingLeft: '1.1rem',
  fontSize: 'var(--fontSize-sm)',
};
