import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import { catalogDefs } from '../src/registry/catalog-defs.js';
import { previews } from '../src/registry/previews.js';
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
// Only components that actually ship a preview spec are listed, so the `missing-preview` health
// check reflects reality rather than asserting every component has one.
const catalog = { components, previews: Object.keys(previews) };

writeFileSync(join(dist, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(join(dist, 'tokens.json'), JSON.stringify(flatTokens, null, 2) + '\n');
writeFileSync(join(dist, 'theme.css'), themeStylesheet());

// Inline the component stylesheet: index.css `@import`s per-group files (which Next resolves in dev),
// but the shipped dist/styles.css must be a single self-contained file.
const stylesDir = join(root, 'src/styles');
const indexCss = readFileSync(join(stylesDir, 'index.css'), 'utf8');
const bundledCss = indexCss.replace(
  /@import\s+'\.\/([^']+)';\n?/g,
  (_m, file: string) => readFileSync(join(stylesDir, file), 'utf8') + '\n',
);
writeFileSync(join(dist, 'styles.css'), bundledCss);

console.log(
  `design-system build: ${Object.keys(components).length} catalog components, ${Object.keys(flatTokens).length} tokens → dist/`,
);
