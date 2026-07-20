import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getScreen, getVersionSpec } from '../../../../lib/screens.js';
import { ScreenPreview } from '../../../../components/ScreenPreview.js';

/**
 * Look at a screen without deploying it (#164).
 *
 * Lives OUTSIDE the `(dashboard)` route group on purpose: the whole value is judging the layout at the
 * width a real user would see, which the dashboard chrome would steal. `?v=` selects the version and
 * matches the detail page; latest wins by default.
 *
 * Reads the STORED version, not editor state — so what you see here is exactly what would deploy.
 */
export const dynamic = 'force-dynamic';

export default async function ScreenPreviewPage({
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
  if (!version) return <Unavailable id={params.id}>This screen has no versions to preview yet.</Unavailable>;

  const specRes = await getVersionSpec(params.id, version);
  if (!specRes) return <Unavailable id={params.id}>Could not load v{version} of this screen.</Unavailable>;

  return <ScreenPreview screenName={screen.name} version={version} spec={specRes.spec} />;
}

function Unavailable({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <main style={fallback}>
      <p>{children}</p>
      <p>
        <Link href={`/screens/${encodeURIComponent(id)}`} style={link}>
          ← Back to the screen
        </Link>
      </p>
    </main>
  );
}

const fallback: CSSProperties = {
  padding: 'var(--space-6)',
  maxWidth: 640,
  margin: '0 auto',
  color: 'var(--color-neutral-700)',
};

const link: CSSProperties = { color: 'var(--primary-default, #2563eb)', textDecoration: 'none' };
