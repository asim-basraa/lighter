import { z } from 'zod';

/**
 * The normalized inventory model — the projection of a design-system repo that ingestion produces.
 * It is a pure data structure (no DB, no framework types) so every downstream surface (dashboard,
 * API, health) consumes the same shape.
 */
export interface InventoryComponent {
  name: string;
  description: string;
  /** Named child slots; `['default']` for containers, `[]` for leaf components. */
  slots: string[];
  /** The component's props as a JSON Schema object (passed through from the catalog artifact). */
  props: Record<string, unknown>;
}

export interface InventoryToken {
  /** Dotted token name, e.g. `color.blue.500`. */
  name: string;
  value: string;
  /** Top-level category derived from the name, e.g. `color`, `space`, `radius`. */
  category: string;
}

export interface InventoryModel {
  components: InventoryComponent[];
  tokens: InventoryToken[];
}

// ---- Artifact contract ------------------------------------------------------
// A design-system repo exposes two machine-readable artifacts in its build directory (default
// `dist/`): `tokens.json` (a flat name→value map) and `catalog.json` (component metadata). These
// Zod schemas are the parse boundary — malformed artifacts fail loudly with a path, never silently.

export const TokensArtifact = z.record(z.string());
export type TokensArtifact = z.infer<typeof TokensArtifact>;

export const CatalogEntryArtifact = z.object({
  description: z.string(),
  slots: z.array(z.string()).default([]),
  props: z.record(z.unknown()),
});

export const CatalogArtifact = z.object({
  components: z.record(CatalogEntryArtifact),
});
export type CatalogArtifact = z.infer<typeof CatalogArtifact>;
