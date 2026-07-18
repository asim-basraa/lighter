import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { catalogDefs } from '../src/registry/catalog-defs.js';
import { objectToJsonSchema } from '../src/schema/zodToJsonSchema.js';
import { flatTokens, themeStylesheet } from '../src/tokens/index.js';

/**
 * Emit the design system's build artifacts into `dist/`:
 *   - catalog.json  — component metadata (Lighter-ingestable; drives AI generation)
 *   - tokens.json   — the flat DTCG-derived token map (Lighter-ingestable)
 *   - theme.css     — token CSS custom properties (:root light + dark overrides)
 *   - styles.css    — the component stylesheet
 *
 * catalog.json + tokens.json satisfy Lighter's ingestion artifact contract, so `POST /ingest`
 * against this package's dist/ yields a full inventory.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

const components: Record<string, { description: string; slots: string[]; props: unknown }> = {};
for (const d of catalogDefs) {
  components[d.name] = {
    description: d.description,
    slots: d.slots ?? [],
    props: objectToJsonSchema(d.props as z.ZodObject<z.ZodRawShape>),
  };
}
const catalog = { components, previews: Object.keys(components) };

writeFileSync(join(dist, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(join(dist, 'tokens.json'), JSON.stringify(flatTokens, null, 2) + '\n');
writeFileSync(join(dist, 'theme.css'), themeStylesheet());
copyFileSync(join(root, 'src/styles/index.css'), join(dist, 'styles.css'));

console.log(
  `design-system build: ${Object.keys(components).length} catalog components, ${Object.keys(flatTokens).length} tokens → dist/`,
);
