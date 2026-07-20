import { RenderSpec } from '../../lib/renderSpec.js';
import spec from '../../specs/checkout-page.json';
import type { Spec } from '@lighter/spec';

/** Checkout — layout exported from Lighter (screen `checkout-page`, v1, approved). */
export default function Page() {
  return <RenderSpec spec={spec as Spec} screenId="checkout-page" />;
}
