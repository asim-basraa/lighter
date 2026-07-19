import { Renderer, StateProvider, VisibilityProvider, ActionProvider } from '@json-render/react';
import { registry } from './registry.js';
import type { PreviewSpec } from './previews.js';

/**
 * Renders a json-render spec against this design system's registry with the full provider stack
 * the renderer requires (state, visibility, actions). Consumers (e.g. Lighter's inventory gallery
 * and review surface) render a spec by dropping in `<SpecView spec={...} />` rather than re-deriving
 * the provider wiring.
 */
export function SpecView({ spec }: { spec: PreviewSpec }) {
  return (
    <StateProvider>
      <VisibilityProvider>
        <ActionProvider handlers={{}}>
          <Renderer spec={spec} registry={registry} />
        </ActionProvider>
      </VisibilityProvider>
    </StateProvider>
  );
}
