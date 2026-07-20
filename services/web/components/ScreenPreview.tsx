import type { CSSProperties } from 'react';
import { SpecView, type PreviewSpec } from '@lighter/design-system';
import { toJsonRender } from '@lighter/spec/render';
import type { Spec } from '@lighter/spec';
import { VersionBanner } from './VersionBanner.js';

/**
 * A stored version rendered full-bleed for its author, with no deploy and no share token (#164).
 *
 * This goes through the SAME `Spec → toJsonRender → <SpecView>` boundary as the public review surface
 * (`SharedMock`) and the consumer app (`apps/shop`). That is the point: a preview that rendered by any
 * other path could drift from what reviewers and users actually see, which is exactly the class of bug
 * #158/#159 were. Anything that changes how a screen renders must change it for all three at once.
 *
 * Deliberately read-only — no annotation layer, no comments. Commenting is anchored to a deployed
 * version and its share token; this is for looking at your own work.
 */
export function ScreenPreview({
  screenName,
  version,
  spec,
}: {
  screenName: string;
  version: number;
  spec: Spec;
}) {
  return (
    <div style={frame}>
      <VersionBanner screenName={screenName} version={version} deployedAt={null} />
      <SpecView spec={toJsonRender(spec) as PreviewSpec} />
    </div>
  );
}

const frame: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--color-neutral-50)',
};
