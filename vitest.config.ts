import { defineConfig } from 'vitest/config';

/**
 * Root test config for the Lighter monorepo. Node is the default environment (the db/ingestion/api
 * suites rely on node APIs); DOM-dependent React tests in services/web opt into happy-dom per-file
 * via a `// @vitest-environment happy-dom` docblock.
 *
 * `esbuild.jsx: 'automatic'` lets the web client's TSX transform without a per-file React import.
 * `lighter-example` is a sibling repo consumed as TS source; inlining it routes its `.tsx` through
 * vitest's transform pipeline (and resolves its `.js` import specifiers to `.tsx`) instead of
 * treating it as an opaque external module.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    server: {
      deps: {
        inline: ['lighter-example'],
      },
    },
  },
});
