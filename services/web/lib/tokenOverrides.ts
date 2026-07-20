import { flatTokens } from '@lighter/design-system';

/**
 * Build a `:root` override sheet from a few live token edits (#171).
 *
 * Tokens are CSS custom properties, so an edit is one `<style>` textContent write in the previewed
 * app — about a frame, with no reload and no app state lost. That is what makes live token editing
 * the cheapest convincing demonstration that the channel works.
 *
 * Scales (density, type) are computed from the design system's own token values rather than
 * hard-coded, so they stay correct when the ingested token set changes.
 */
export interface TokenEdits {
  /** Brand colour — `--primary-*`. */
  primary?: string;
  /** Page background — `--background-canvas`. */
  background?: string;
  /** Body text colour — `--foreground-default`. */
  foreground?: string;
  /** Multiplier on every `--radius-*` (1 = unchanged). */
  radiusScale?: number;
  /** Multiplier on every `--spacing-*` — layout density. */
  spaceScale?: number;
  /** Multiplier on every `--font-size-*` — type scale. */
  fontScale?: number;
}

export const DEFAULT_EDITS: Required<Pick<TokenEdits, 'radiusScale' | 'spaceScale' | 'fontScale'>> = {
  radiusScale: 1,
  spaceScale: 1,
  fontScale: 1,
};

/** Scale a `12px`-style value, leaving anything unparseable (`9999px`, `0px`, `%`) alone. */
function scalePx(value: string, factor: number): string | null {
  const match = /^(-?[\d.]+)px$/.exec(value.trim());
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n === 0) return null;
  // Round to a device pixel; sub-pixel token values cause blurry borders.
  return `${Math.round(n * factor * 100) / 100}px`;
}

/** Token keys (`spacing.4`) map to CSS vars (`--spacing-4`); `fontSize` kebabs to `font-size`. */
function cssVarFor(group: string, step: string): string {
  const prefix = group === 'fontSize' ? 'font-size' : group;
  return `--${prefix}-${step}`;
}

/**
 * Steps that are sentinels rather than measurements. `radius.full` is 9999px meaning "fully round" —
 * scaling it to 19998px is meaningless, and `none` must stay 0.
 */
const SENTINEL_STEPS = new Set(['full', 'none']);

function scaledGroup(group: 'spacing' | 'fontSize' | 'radius', factor: number): string[] {
  if (factor === 1) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(flatTokens)) {
    if (!key.startsWith(`${group}.`)) continue;
    if (typeof value !== 'string') continue;
    const step = key.slice(group.length + 1);
    if (SENTINEL_STEPS.has(step)) continue;
    const scaled = scalePx(value, factor);
    if (scaled) out.push(`  ${cssVarFor(group, step)}: ${scaled};`);
  }
  return out;
}

/**
 * The selector the override sheet uses.
 *
 * It must out-rank the design system's own theme rules, and specificity beats source order — so a
 * plain `:root` (0,1,0) loses to `:root[data-theme="dark"]` (0,2,0) no matter how late it's appended.
 * Getting this wrong is silent: overrides simply do nothing for anyone in dark mode.
 *
 * A selector list takes each selector's specificity independently, so including the themed forms
 * ties the theme rules and, being later, wins — in light and dark alike.
 */
const OVERRIDE_SELECTOR =
  ':root, :root[data-theme="dark"], :root[data-theme="light"], .dark';

/**
 * The override sheet. Returns '' when nothing is edited, so the studio can push a cleared sheet to
 * restore the app's own tokens without reloading it.
 */
export function buildTokenCss(edits: TokenEdits): string {
  const lines: string[] = [];

  if (edits.primary) {
    // Only `--primary-default` is a real brand decision here; hover/active are derived so the
    // preview stays coherent rather than showing a flat, state-less button.
    lines.push(`  --primary-default: ${edits.primary};`);
    lines.push(`  --primary-hover: color-mix(in srgb, ${edits.primary} 88%, black);`);
    lines.push(`  --primary-active: color-mix(in srgb, ${edits.primary} 76%, black);`);
    lines.push(`  --primary-subtle: color-mix(in srgb, ${edits.primary} 12%, white);`);
    lines.push(`  --ring-default: ${edits.primary};`);
  }
  if (edits.background) lines.push(`  --background-canvas: ${edits.background};`);
  if (edits.foreground) lines.push(`  --foreground-default: ${edits.foreground};`);

  lines.push(...scaledGroup('radius', edits.radiusScale ?? 1));
  lines.push(...scaledGroup('spacing', edits.spaceScale ?? 1));
  lines.push(...scaledGroup('fontSize', edits.fontScale ?? 1));

  if (lines.length === 0) return '';
  return `${OVERRIDE_SELECTOR} {\n${lines.join('\n')}\n}\n`;
}
