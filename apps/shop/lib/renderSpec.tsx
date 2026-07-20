import { SpecView } from '@lighter/design-system';
import { toJsonRender, type Spec } from '@lighter/spec';

/**
 * Render a Lighter spec with this app's design system (#153).
 *
 * The specs under `specs/` are the ones EXPORTED from Lighter after approval — the hand-off bundle's
 * `spec` field, committed into the repo. That's the real-world loop: a screen is authored/amended and
 * reviewed in Lighter, approved, exported, and the export lands here as the page's layout. The app
 * owns routing, chrome and state; Lighter owns the screen.
 *
 * Conversion to json-render happens at this boundary (`@lighter/spec`), exactly as the studio does it,
 * so the shop and the review link render byte-identical output.
 */
export function RenderSpec({ spec }: { spec: Spec }) {
  return <SpecView spec={toJsonRender(spec)} />;
}
