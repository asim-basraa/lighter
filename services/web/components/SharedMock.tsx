'use client';

import type { CSSProperties } from 'react';
import { SpecView, type PreviewSpec } from '@lighter/design-system';
import { toJsonRender } from '@lighter/spec/render';
import type { SharedVersion } from '../lib/share.js';
import { VersionBanner } from './VersionBanner.js';
import { FlowNav } from './FlowNav.js';

/**
 * Render a deployed mock: a prototype banner (screen, version, deploy date) above the shared spec
 * version, live through the design system's `<SpecView>`. The internal spec is converted to
 * json-render form at the boundary (see `@lighter/spec/render`), so the public bundle never pulls in
 * the node-only catalog validator. No account is needed to view this — the share token in the URL is
 * the only credential (resolved server-side before this renders).
 *
 * `annotate` tags each element with its spec id so the review layer can hit-test and anchor comments
 * (#160). The carriers use `display: contents`, so the rendered boxes stay identical to a consumer
 * app's — the review surface must show what the product shows (#158).
 */
export function SharedMock({ share, annotate = false }: { share: SharedVersion; annotate?: boolean }) {
  return (
    <div style={frame}>
      <VersionBanner
        screenName={share.screen.name}
        version={share.version}
        deployedAt={share.deployedAt}
      />
      <FlowNav flow={share.flow} />
      <SpecView spec={toJsonRender(share.spec) as PreviewSpec} annotate={annotate} />
    </div>
  );
}

const frame: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--color-neutral-50)',
};
