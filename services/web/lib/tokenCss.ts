import { themeStylesheet, flatTokens } from '@lighter/design-system';

/**
 * The design system's own token stylesheet, plus back-compat aliases for the studio chrome (#158).
 *
 * The design system OWNS this CSS: `themeStylesheet()` expands DTCG composite tokens into the exact
 * custom properties its component CSS consumes (`--text-heading-font-size`, …) and ships the
 * dark-theme block. The studio used to flatten `flatTokens` itself, which emitted camelCase
 * (`--text-heading-fontSize`); the components expect kebab-case, so every rule built on a composite
 * typography token silently fell back to inherited 16px/400 — a reviewed screen did NOT match what a
 * consumer app renders. Deriving from the design system keeps a single source of truth.
 *
 * The chrome predates the design system's naming and references `--fontSize-*` / `--space-*`; alias
 * those to the canonical `--font-size-*` / `--spacing-*` rather than rewriting every inline style.
 */
export function tokenRootCss(): string {
  const aliases: string[] = [];
  for (const key of Object.keys(flatTokens)) {
    if (key.startsWith('fontSize.')) {
      const step = key.slice('fontSize.'.length);
      aliases.push(`  --fontSize-${step}: var(--font-size-${step});`);
    } else if (key.startsWith('spacing.')) {
      const step = key.slice('spacing.'.length);
      aliases.push(`  --space-${step}: var(--spacing-${step});`);
    }
  }
  return `${themeStylesheet()}\n:root {\n${aliases.join('\n')}\n}\n`;
}
