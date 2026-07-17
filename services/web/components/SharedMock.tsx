'use client';

import type { CSSProperties } from 'react';
import { SpecView, type PreviewSpec } from 'lighter-example/ui';
import { toJsonRender } from '@lighter/spec/render';
import type { SharedVersion } from '../lib/share.js';
import { VersionBanner } from './VersionBanner.js';

/**
 * Render a deployed mock: a prototype banner (screen, version, deploy date) above the shared spec
 * version, live through lighter-example's `<SpecView>`. The internal spec is converted to json-render
 * form at the boundary (see `@lighter/spec/render`), so the public bundle never pulls in the node-only
 * catalog validator. No account is needed to view this — the share token in the URL is the only
 * credential (resolved server-side before this renders).
 */
export function SharedMock({ share }: { share: SharedVersion }) {
  return (
    <div style={frame}>
      <VersionBanner
        screenName={share.screen.name}
        version={share.version}
        deployedAt={share.deployedAt}
      />
      <SpecView spec={toJsonRender(share.spec) as PreviewSpec} />
    </div>
  );
}

const frame: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--color-neutral-50)',
};
