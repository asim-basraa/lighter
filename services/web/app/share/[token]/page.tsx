import type { CSSProperties } from 'react';
import { loadShare } from '../../../lib/share.js';
import { loadComments, apiCommentsFetcher } from '../../../lib/comments.js';
import { specElements } from '../../../lib/specElements.js';
import { SharedMock } from '../../../components/SharedMock.js';
import { CommentsPanel } from '../../../components/CommentsPanel.js';

/**
 * The public review surface: a deployed mock addressed by its share token, with a comment panel
 * alongside it. No account — the token in the URL is the only credential (resolved server-side by the
 * API). Rendered per-request against the live API so a freshly deployed version is viewable
 * immediately, with no per-version build step.
 */
export const dynamic = 'force-dynamic';

export default async function SharePage({ params }: { params: { token: string } }) {
  const { share, error } = await loadShare(params.token);
  if (!share) {
    return (
      <main style={notFound}>
        <p>{error ?? 'This shared mock is unavailable.'}</p>
      </main>
    );
  }
  const { comments, error: commentsError } = await loadComments(apiCommentsFetcher(params.token));
  return (
    <div style={layout}>
      <div style={mockPane}>
        <SharedMock share={share} />
      </div>
      <CommentsPanel
        token={params.token}
        elements={specElements(share.spec)}
        initialComments={comments}
        loadError={commentsError}
      />
    </div>
  );
}

const layout: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  minHeight: '100vh',
};

const mockPane: CSSProperties = { flex: 1, minWidth: 0 };

const notFound: CSSProperties = {
  padding: 'var(--space-6)',
  maxWidth: 640,
  margin: '0 auto',
  color: 'var(--color-neutral-700)',
};
