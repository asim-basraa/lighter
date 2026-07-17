import type { CSSProperties } from 'react';
import { loadShare } from '../../../lib/share.js';
import { SharedMock } from '../../../components/SharedMock.js';

/**
 * The public review surface: a deployed mock addressed by its share token. No account — the token in
 * the URL is the only credential (resolved server-side by the API). Rendered per-request against the
 * live API so a freshly deployed version is viewable immediately, with no per-version build step.
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
  return <SharedMock share={share} />;
}

const notFound: CSSProperties = {
  padding: 'var(--space-6)',
  maxWidth: 640,
  margin: '0 auto',
  color: 'var(--color-neutral-700)',
};
