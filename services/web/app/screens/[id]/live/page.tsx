import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getScreen, getVersionSpec, getDraft } from '../../../../lib/screens.js';
import { resolvePreviewOrigin, isMixedContentBlocked } from '../../../../lib/previewOrigins.js';
import { loadInventory, apiInventoryFetcher } from '../../../../lib/inventory.js';
import { apiAuthHeaders } from '../../../../lib/session.js';
import { LivePreview } from '../../../../components/LivePreview.js';

/**
 * Live preview (#166): the REAL app in an iframe, driven by this studio over postMessage.
 *
 * Outside the `(dashboard)` group so the app gets a realistic width. The framed origin comes from a
 * server-side allowlist, never from a query string — the studio must not become a redirector that
 * frames arbitrary content under Lighter's chrome.
 */
export const dynamic = 'force-dynamic';

export default async function LivePreviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { v?: string; origin?: string };
}) {
  const screen = await getScreen(params.id);
  if (!screen) notFound();

  const versions = screen.versions;
  const requested = Number(searchParams.v);
  const version = versions.includes(requested) ? requested : (versions.at(-1) ?? 0);

  const { origin, allowed } = await resolvePreviewOrigin(searchParams.origin);
  if (!origin) return <Unavailable id={params.id}>No app origin available to preview.</Unavailable>;

  // Resume an in-progress draft if there is one, so reopening the editor doesn't discard work.
  // Falls back to the selected version, which is also what a fresh screen starts from.
  const [draft, specRes, inventory] = await Promise.all([
    getDraft(params.id),
    version ? getVersionSpec(params.id, version) : Promise.resolve(null),
    // Auth headers matter: without them this reads the GLOBAL /inventory, which is empty in
    // scoped mode — the editor would silently have no catalog to insert from.
    apiAuthHeaders().then((headers) => loadInventory(apiInventoryFetcher(undefined, headers))),
  ]);
  const spec = draft ?? specRes?.spec ?? null;
  if (!spec) return <Unavailable id={params.id}>This screen has no version to preview yet.</Unavailable>;

  const proto = (headers().get('x-forwarded-proto') ?? 'http').split(',')[0]!.trim();

  return (
    <LivePreview
      screenId={screen.id}
      versions={versions}
      initialVersion={version}
      initialSpec={spec}
      hasDraft={draft !== null}
      catalog={(inventory.model?.components ?? []).map((c) => ({
        name: c.name,
        slots: c.slots,
        props: c.props,
      }))}
      origin={origin}
      allowedOrigins={allowed}
      mixedContentBlocked={isMixedContentBlocked(`${proto}:`, origin)}
    />
  );
}

function Unavailable({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <main style={fallback}>
      <p>{children}</p>
      <p>
        <Link href={`/screens/${encodeURIComponent(id)}`} style={link}>← Back to the screen</Link>
      </p>
    </main>
  );
}

const fallback: CSSProperties = { padding: 'var(--space-6)', maxWidth: 640, margin: '0 auto' };
const link: CSSProperties = { color: 'var(--primary-default, #2563eb)', textDecoration: 'none' };
