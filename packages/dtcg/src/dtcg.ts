/**
 * A dependency-free resolver for the DTCG (Design Tokens Community Group, W3C-track) format, focused
 * on the artifact Lighter ingests: a flat `name → value` map (the tokens.json contract).
 *
 * A DTCG document is a tree of *groups* (plain objects) and *tokens* (objects with a `$value`). A
 * `$value` may be a scalar (`"#2563eb"`, `"16px"`, a number), an array (a font stack), a composite
 * object (a typography/shadow token), or an *alias* — a string `"{group.token}"` that references
 * another token by its dotted path. Standardizing token ingestion on DTCG means any team using Style
 * Dictionary or Tokens Studio is compatible with no Lighter-specific authoring.
 */

export type DtcgDoc = Record<string, unknown>;

const ALIAS = /^\{([^}]+)\}$/;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isToken = (v: unknown): v is Record<string, unknown> => isRecord(v) && '$value' in v;

/** Walk one or more DTCG docs into `dotted.path → raw $value`. Later docs win (theme overrides). */
function collect(docs: DtcgDoc[]): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const walk = (node: Record<string, unknown>, path: string[]): void => {
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue; // $type/$description/etc. are metadata
      if (!isRecord(child)) continue;
      const childPath = [...path, key];
      if (isToken(child)) out.set(childPath.join('.'), child.$value);
      else walk(child, childPath);
    }
  };
  for (const doc of docs) walk(doc, []);
  return out;
}

/** Stringify a resolved value for the flat map: scalars as-is, arrays/composites as JSON. */
function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

/**
 * Resolve DTCG docs into the flat `name → value` tokens map. Aliases are dereferenced (multi-hop),
 * with circular-reference and unknown-reference detection so a malformed token set fails loudly rather
 * than emitting a broken artifact.
 */
export function dtcgToTokens(...docs: DtcgDoc[]): Record<string, string> {
  const raw = collect(docs);

  const resolve = (path: string, value: unknown, chain: string[]): unknown => {
    if (typeof value !== 'string') return value;
    const match = ALIAS.exec(value.trim());
    if (!match) return value;
    const target = match[1]!;
    if (chain.includes(target)) {
      throw new Error(`circular token alias: ${[...chain, target].join(' → ')}`);
    }
    if (!raw.has(target)) {
      throw new Error(`token "${path}" references unknown token "${target}"`);
    }
    return resolve(target, raw.get(target), [...chain, target]);
  };

  const out: Record<string, string> = {};
  for (const [path, value] of raw) {
    out[path] = stringify(resolve(path, value, [path]));
  }
  return out;
}
