import { studioOrigins } from '../../lib/studioOrigins.js';
import { RenderSpec } from '../../lib/renderSpec.js';
import spec from '../../specs/product.json';
import { SpecSchema } from '@lighter/spec';

/**
 * Rendered per request, not prerendered.
 *
 * `studioOrigins()` reads LIGHTER_STUDIO_ORIGINS from the environment. On a statically prerendered
 * page that read happens at BUILD time — inside the Docker build, where the variable isn't set — so
 * the localhost default would be baked into the image and the deployed app would refuse to be driven
 * by the deployed studio. Verified: the first shop image shipped with `localhost:4000` embedded.
 */
export const dynamic = 'force-dynamic';

/** Product detail — layout exported from Lighter (screen `product`, v1, approved). */
export default function Page() {
  return <RenderSpec spec={SpecSchema.parse(spec)} screenId="product" studioOrigins={studioOrigins()} />;
}
