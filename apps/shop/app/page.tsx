import { RenderSpec } from '../lib/renderSpec.js';
import spec from '../specs/storefront.json';
import type { Spec } from '@lighter/spec';

/** Storefront — layout exported from Lighter (screen `storefront`, v1, approved). */
export default function Page() {
  return <RenderSpec spec={spec as Spec} screenId="storefront" />;
}
