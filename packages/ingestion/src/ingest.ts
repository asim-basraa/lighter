import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import { computeHealth } from './health.js';
import {
  CatalogArtifact,
  TokensArtifact,
  type InventoryComponent,
  type InventoryModel,
  type InventoryToken,
} from './model.js';

export interface IngestOptions {
  /** Build directory within the repo holding the artifacts. Defaults to `dist`. */
  artifactDir?: string;
}

/** Read + JSON-parse + schema-validate an artifact, always failing loudly with the file path. */
function parseArtifact<S extends z.ZodTypeAny>(path: string, schema: S): z.infer<S> {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Ingestion could not read required artifact: ${path}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Ingestion found invalid JSON in ${path}: ${(err as Error).message}`);
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    throw new Error(`Ingestion found a malformed artifact at ${path}: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Build the normalized inventory model from already-parsed artifacts. Pure: no disk, no DB, no
 * network — the same inputs always yield the same model, sorted by name for stable, diffable output.
 * This is the shared core behind both `ingest` (reads from disk) and `ingestArtifacts` (reads from a
 * request body), so the on-disk and pushed paths can never diverge.
 */
export function buildInventory(catalog: CatalogArtifact, tokensMap: TokensArtifact): InventoryModel {
  const tokens: InventoryToken[] = Object.entries(tokensMap)
    .map(([name, value]) => ({ name, value, category: name.split('.')[0] ?? name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const components: InventoryComponent[] = Object.entries(catalog.components)
    .map(([name, entry]) => ({
      name,
      description: entry.description,
      slots: entry.slots,
      props: entry.props,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const health = computeHealth(catalog, tokens);

  return { components, tokens, health };
}

/**
 * Ingest a design system from artifacts supplied in-memory (the cloud push path, #90): the CLI /
 * GitHub Action sends `{ catalog, tokens }` as a request body instead of the API reading a path off
 * its own filesystem. Validates both against the artifact schemas (a `ZodError` on malformed input,
 * which the route maps to a 400) and reuses `buildInventory`, so pushed and on-disk ingestion are
 * identical downstream.
 */
export function ingestArtifacts(catalog: unknown, tokens: unknown): InventoryModel {
  const parsedTokens = TokensArtifact.parse(tokens);
  const parsedCatalog = CatalogArtifact.parse(catalog);
  return buildInventory(parsedCatalog, parsedTokens);
}

/**
 * Ingest a design-system repo into the normalized inventory model. Pure over the repo's artifacts:
 * it only reads `<repo>/<artifactDir>/{tokens.json,catalog.json}` from disk — no database, no
 * network — so the same repo at the same commit always yields the same model.
 */
export function ingest(repoPath: string, opts: IngestOptions = {}): InventoryModel {
  const dir = opts.artifactDir ?? 'dist';
  const tokensMap = parseArtifact(join(repoPath, dir, 'tokens.json'), TokensArtifact);
  const catalog = parseArtifact(join(repoPath, dir, 'catalog.json'), CatalogArtifact);
  return buildInventory(catalog, tokensMap);
}
