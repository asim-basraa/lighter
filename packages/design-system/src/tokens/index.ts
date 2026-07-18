import primitives from '../../tokens/primitives.tokens.json';
import semanticLight from '../../tokens/semantic.tokens.json';
import semanticDark from '../../tokens/semantic-dark.tokens.json';
import {
  resolveTokens,
  toCssDeclarations,
  toFlatTokens,
  tokenPaths,
  type DtcgDoc,
  type ResolvedTokens,
} from './dtcg.js';

export * from './dtcg.js';

/** The default (light) theme: primitives + light semantics, fully resolved. */
export const tokens: ResolvedTokens = resolveTokens([
  primitives as DtcgDoc,
  semanticLight as DtcgDoc,
]);

/** The flat `name → value` map (the `tokens.json` artifact Lighter ingests). */
export const flatTokens: Record<string, string> = toFlatTokens(tokens);

/**
 * The full theme stylesheet: every token under `:root` (light), plus the dark-theme color overrides
 * under `:root[data-theme="dark"]` and `.dark`. `ThemeProvider` injects this; `dist/theme.css` ships
 * it for framework-agnostic consumers.
 */
export function themeStylesheet(): string {
  const darkResolved = resolveTokens([primitives as DtcgDoc, semanticDark as DtcgDoc]);
  const darkPaths = new Set(tokenPaths([semanticDark as DtcgDoc]));
  const darkOnly: ResolvedTokens = new Map([...darkResolved].filter(([p]) => darkPaths.has(p)));

  const light = toCssDeclarations(tokens).join('\n  ');
  const dark = toCssDeclarations(darkOnly).join('\n  ');
  return (
    `:root {\n  color-scheme: light;\n  ${light}\n}\n\n` +
    `:root[data-theme="dark"],\n.dark {\n  color-scheme: dark;\n  ${dark}\n}\n`
  );
}
