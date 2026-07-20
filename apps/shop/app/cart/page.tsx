import { studioOrigins } from '../../lib/studioOrigins.js';
import { RenderSpec } from '../../lib/renderSpec.js';
import spec from '../../specs/cart.json';
import type { Spec } from '@lighter/spec';

/** Cart — layout exported from Lighter (screen `cart`, v1, approved). */
export default function Page() {
  return <RenderSpec spec={spec as Spec} screenId="cart" studioOrigins={studioOrigins()} />;
}
