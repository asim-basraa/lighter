'use client';

import { useRouter } from 'next/navigation';
import { SpecView } from '@lighter/design-system';
import { toJsonRender, SpecSchema, type Spec } from '@lighter/spec';
import { useLighterPreview } from '@lighter/preview/react';

/**
 * Render a Lighter spec with this app's design system (#153), live-editable from the studio (#166).
 *
 * The specs under `specs/` are the ones EXPORTED from Lighter after approval — the hand-off bundle's
 * `spec` field, committed into the repo. That's the real-world loop: a screen is authored/amended and
 * reviewed in Lighter, approved, exported, and the export lands here as the page's layout. The app
 * owns routing, chrome and state; Lighter owns the screen.
 *
 * When this app is framed by an allowlisted Lighter studio, that studio can push spec and token edits
 * in real time. Nothing else changes — routing, data fetching, cart state and the real APIs stay the
 * app's. Outside such a frame `useLighterPreview` is inert, so production is unaffected.
 *
 * Conversion to json-render happens at this boundary (`@lighter/spec`), exactly as the studio does it,
 * so the shop and the review link render byte-identical output.
 */
export function RenderSpec({ spec, screenId }: { spec: Spec; screenId?: string }) {
  const router = useRouter();
  const { spec: live, connected } = useLighterPreview<Spec>(spec, {
    allowedOrigins: allowedStudioOrigins(),
    screenId: screenId ?? null,
    // Refuse anything that isn't a well-formed spec, so a mid-edit keystroke leaves the previous
    // screen up and reports back instead of white-screening the storefront.
    validate: isSpec,
    onRefresh: () => router.refresh(),
  });

  return (
    <>
      <SpecView spec={toJsonRender(live)} />
      {connected && <LiveBadge />}
    </>
  );
}

function isSpec(value: unknown): value is Spec {
  return SpecSchema.safeParse(value).success;
}

/**
 * Which Lighter studios may drive this app. Configured, never inferred — an app must name who is
 * allowed to control it. Defaults to the local studio so `pnpm dev` works with no setup.
 */
function allowedStudioOrigins(): string[] {
  const configured = process.env.NEXT_PUBLIC_LIGHTER_STUDIO_ORIGINS;
  if (configured) return configured.split(',').map((o) => o.trim());
  return ['http://localhost:4000'];
}

/** A small, unmistakable marker that what you're looking at is being driven by Lighter. */
function LiveBadge() {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        right: '0.75rem',
        bottom: '0.75rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.3rem 0.7rem',
        borderRadius: 999,
        background: 'rgb(37 99 235 / 0.95)',
        color: '#fff',
        font: '600 12px/1 ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 2px 10px rgb(15 23 42 / 0.3)',
      }}
    >
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />
      Live from Lighter
    </div>
  );
}
