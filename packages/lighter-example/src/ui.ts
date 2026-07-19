/**
 * The browser-safe runtime surface of the design system — everything a consumer needs to RENDER
 * components, and nothing that touches Node. Lighter's web client imports from here (not the `.`
 * barrel) so its bundle never pulls in the build-time code (`build.ts`/`build-catalog.ts`, which
 * use `node:fs` and `zod-to-json-schema`). Keep this export list free of any Node-only module.
 */
export * from './components.js';
export { catalog, components, componentNames } from './catalog.js';
export { registry } from './registry.js';
export { SpecView } from './render.js';
export { previews, type PreviewSpec } from './previews.js';
export { tokens, type Tokens } from './tokens.js';
