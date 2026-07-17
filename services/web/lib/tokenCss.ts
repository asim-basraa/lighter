import { tokens, type Tokens } from 'lighter-example/ui';

/**
 * Generate the design system's tokens as a `:root` custom-property block, dotted keys becoming
 * dashed variable names (`color.blue.500` → `--color-blue-500`). The web client inlines this instead
 * of importing lighter-example's built `dist/tokens.css`: `dist/` is a gitignored build artifact and
 * is not packed into the `file:` dependency copy, so importing it would break `next build`. Deriving
 * from the shared `tokens` object keeps a single source of truth with no build-order coupling.
 */
function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      out[key] = v;
    } else if (v && typeof v === 'object') {
      Object.assign(out, flatten(v, key));
    }
  }
  return out;
}

export function tokenRootCss(source: Tokens = tokens): string {
  const flat = flatten(source);
  const lines = Object.entries(flat).map(
    ([key, value]) => `  --${key.replace(/\./g, '-')}: ${value};`,
  );
  return `:root {\n${lines.join('\n')}\n}\n`;
}
