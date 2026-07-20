import { studioOrigins } from '../../lib/studioOrigins.js';
import { RenderSpec } from '../../lib/renderSpec.js';
import spec from '../../specs/product.json';
import type { Spec } from '@lighter/spec';

/** Product detail — layout exported from Lighter (screen `product`, v1, approved). */
export default function Page() {
  return <RenderSpec spec={spec as Spec} screenId="product" studioOrigins={studioOrigins()} />;
}
