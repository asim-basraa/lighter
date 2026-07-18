/**
 * A minimal, dependency-free transformer for the DTCG (Design Tokens Community Group) format.
 *
 * A DTCG document is a tree of *groups* (plain objects) and *tokens* (objects with a `$value`).
 * `$type` is inherited down a group. A `$value` may be a scalar (color hex, `"8px"`, a number), an
 * array (a font-family stack, a cubic-bezier), a composite object (e.g. a `typography` token), or an
 * *alias* — a string `"{group.token}"` that references another token by its dotted path.
 *
 * This module resolves aliases + composites and emits (a) CSS custom properties and (b) a flat
 * `name → value` map — the artifact Lighter ingests. Swap the DTCG source and everything downstream
 * re-themes; that is the whole point of the design system.
 */

export type DtcgDoc = Record<string, unknown>;

type Scalar = string | number;
type RawValue = Scalar | Scalar[] | Record<string, unknown>;

export interface ResolvedToken {
  /** The DTCG `$type` (color, dimension, number, fontWeight, fontFamily, cubicBezier, shadow, typography, …). */
  type: string;
  /** The fully-resolved value (no aliases remain). Composite tokens keep an object of resolved subs. */
  value: RawValue;
}

/** Fully-resolved tokens keyed by dotted path, e.g. `"color.blue.500"`. */
export type ResolvedTokens = Map<string, ResolvedToken>;

const ALIAS = /^\{([^}]+)\}$/;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isToken = (v: unknown): v is Record<string, unknown> => isRecord(v) && '$value' in v;

/** Walk one or more DTCG docs into `path → { rawValue, type }`, applying inherited `$type`. Later docs win. */
function flatten(docs: DtcgDoc[]): Map<string, { raw: RawValue; type: string }> {
  const out = new Map<string, { raw: RawValue; type: string }>();
  const walk = (node: Record<string, unknown>, path: string[], inheritedType: string): void => {
    const type = typeof node.$type === 'string' ? node.$type : inheritedType;
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      if (!isRecord(child)) continue;
      const childPath = [...path, key];
      if (isToken(child)) {
        const ownType = typeof child.$type === 'string' ? child.$type : type;
        out.set(childPath.join('.'), { raw: child.$value as RawValue, type: ownType });
      } else {
        walk(child, childPath, type);
      }
    }
  };
  for (const doc of docs) walk(doc, [], '');
  return out;
}

/** The leaf token paths declared by the given docs (unresolved) — e.g. to scope a theme override. */
export function tokenPaths(docs: DtcgDoc[]): string[] {
  return [...flatten(docs).keys()];
}

/** Resolve a DTCG doc set into fully-resolved tokens (aliases + composite sub-values dereferenced). */
export function resolveTokens(docs: DtcgDoc[]): ResolvedTokens {
  const flat = flatten(docs);
  const resolved: ResolvedTokens = new Map();
  const resolving = new Set<string>();

  const deref = (value: RawValue, type: string, forPath: string): RawValue => {
    if (typeof value === 'string') {
      const m = ALIAS.exec(value);
      if (!m) return value;
      const target = m[1]!;
      const t = resolvePath(target);
      if (!t) throw new Error(`Token "${forPath}" references unknown token "{${target}}"`);
      return t.value;
    }
    if (isRecord(value)) {
      // Composite (e.g. typography): resolve each sub-value, which may itself be an alias.
      const composite: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value))
        composite[k] = deref(v as RawValue, type, forPath);
      return composite;
    }
    return value; // scalar or array (font stack / cubic-bezier) — arrays never alias here
  };

  function resolvePath(path: string): ResolvedToken | undefined {
    const cached = resolved.get(path);
    if (cached) return cached;
    const entry = flat.get(path);
    if (!entry) return undefined;
    if (resolving.has(path)) throw new Error(`Token alias cycle at "${path}"`);
    resolving.add(path);
    const token: ResolvedToken = { type: entry.type, value: deref(entry.raw, entry.type, path) };
    resolving.delete(path);
    resolved.set(path, token);
    return token;
  }

  for (const path of flat.keys()) resolvePath(path);
  return resolved;
}

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** `color.blue.500` → `--color-blue-500`, `foreground.onEmphasis` → `--foreground-on-emphasis`. */
export function cssVarName(path: string): string {
  return `--${path.split('.').map(kebab).join('-')}`;
}

const quoteFontMember = (m: string): string => (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(m) ? m : `"${m}"`);

/** Format a resolved scalar/array value as a CSS value string. */
function scalarCss(type: string, value: Scalar | Scalar[]): string {
  if (Array.isArray(value)) {
    if (type === 'cubicBezier') return `cubic-bezier(${value.join(', ')})`;
    return value.map((m) => quoteFontMember(String(m))).join(', '); // fontFamily stack
  }
  return String(value);
}

/**
 * Emit CSS custom-property declarations (`--name: value;`) for a resolved token set. A composite
 * `typography` token expands into one variable per sub-property (`--text-body-font-size`, …).
 */
export function toCssDeclarations(resolved: ResolvedTokens): string[] {
  const lines: string[] = [];
  for (const [path, token] of resolved) {
    if (isRecord(token.value)) {
      for (const [sub, subVal] of Object.entries(token.value)) {
        lines.push(
          `${cssVarName(`${path}.${kebab(sub)}`)}: ${scalarCss('', subVal as Scalar | Scalar[])};`,
        );
      }
    } else {
      lines.push(`${cssVarName(path)}: ${scalarCss(token.type, token.value)};`);
    }
  }
  return lines;
}

/** Wrap resolved token sets into a stylesheet, one CSS block per selector. */
export function themeCss(scopes: Record<string, ResolvedTokens>): string {
  return Object.entries(scopes)
    .map(
      ([selector, resolved]) => `${selector} {\n  ${toCssDeclarations(resolved).join('\n  ')}\n}`,
    )
    .join('\n\n')
    .concat('\n');
}

/**
 * A flat `name → value` map — the `tokens.json` artifact Lighter ingests (all values are strings).
 * Composite tokens expand into `path.sub` entries so every leaf is representable.
 */
export function toFlatTokens(resolved: ResolvedTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, token] of resolved) {
    if (isRecord(token.value)) {
      for (const [sub, subVal] of Object.entries(token.value)) {
        out[`${path}.${sub}`] = scalarCss('', subVal as Scalar | Scalar[]);
      }
    } else {
      out[path] = scalarCss(token.type, token.value);
    }
  }
  return out;
}
