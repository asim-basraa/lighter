import type { CSSProperties } from 'react';
import { loadShare } from '../../../lib/share.js';
import { loadComments, apiCommentsFetcher } from '../../../lib/comments.js';
import { specElements } from '../../../lib/specElements.js';
import { ReviewSurface } from '../../../components/ReviewSurface.js';

/**
 * The public review surface: a deployed mock addressed by its share token. No account — the token in
 * the URL is the only credential (resolved server-side by the API). Rendered per-request against the
 * live API so a freshly deployed version is viewable immediately, with no per-version build step.
 *
 * The screen gets the FULL viewport (#160): comments float above it in an overlay rather than taking a
 * permanent column, so reviewers judge the layout at a width a real user would actually see.
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
    <ReviewSurface
      share={share}
      token={params.token}
      elements={specElements(share.spec)}
      initialComments={comments}
      loadError={commentsError}
    />
  );
}

const notFound: CSSProperties = {
  padding: 'var(--space-6)',
  maxWidth: 640,
  margin: '0 auto',
  color: 'var(--color-neutral-700)',
};
