import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

function readJson(path: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Ingestion could not read required artifact: ${path}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Ingestion found invalid JSON in ${path}: ${(err as Error).message}`);
  }
}

/**
 * Ingest a design-system repo into the normalized inventory model. Pure over the repo's artifacts:
 * it only reads `<repo>/<artifactDir>/{tokens.json,catalog.json}` from disk — no database, no
 * network — so the same repo at the same commit always yields the same model. Results are sorted by
 * name for stable, diffable output.
 */
export function ingest(repoPath: string, opts: IngestOptions = {}): InventoryModel {
  const dir = opts.artifactDir ?? 'dist';

  const tokensMap = TokensArtifact.parse(readJson(join(repoPath, dir, 'tokens.json')));
  const catalog = CatalogArtifact.parse(readJson(join(repoPath, dir, 'catalog.json')));

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

  return { components, tokens };
}
