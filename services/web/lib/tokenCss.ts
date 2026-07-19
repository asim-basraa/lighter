import { flatTokens } from '@lighter/design-system';

/**
 * Generate the design system's tokens as a `:root` custom-property block, dotted keys becoming dashed
 * variable names (`primary.default` → `--primary-default`, `color.blue.500` → `--color-blue-500`).
 * The studio inlines this so its chrome and the rendered specs share one visual source — the blue/grey
 * `@lighter/design-system` (swap its DTCG tokens and everything re-themes; see the design-system package).
 *
 * `flatTokens` is already flat, so no recursion is needed. We also emit `--space-N` aliases for
 * `--spacing-N`: the studio chrome predates the design system's `spacing.*` naming and references
 * `--space-*`, so aliasing keeps the chrome spacing intact with no chrome edits.
 */
export function tokenRootCss(source: Record<string, string> = flatTokens): string {
  const lines = Object.entries(source).map(
    ([key, value]) => `  --${key.replace(/\./g, '-')}: ${value};`,
  );
  const spaceAliases = Object.keys(source)
    .filter((k) => k.startsWith('spacing.'))
    .map((k) => {
      const n = k.slice('spacing.'.length);
      return `  --space-${n}: var(--spacing-${n});`;
    });
  return `:root {\n${[...lines, ...spaceAliases].join('\n')}\n}\n`;
}
