import { describe, it, expect } from 'vitest';
import { tokenRootCss } from './tokenCss.js';

describe('tokenRootCss', () => {
  const css = tokenRootCss();

  it('emits a :root block of custom properties', () => {
    expect(css).toContain(':root {');
    expect(css.trim().endsWith('}')).toBe(true);
  });

  it('flattens nested token groups to dashed variable names (no dots)', () => {
    expect(css).toMatch(/--color-blue-500:\s*\S+;/);
    expect(css).toMatch(/--space-4:\s*\S+;/);
    const varNames = [...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1]!);
    expect(varNames.length).toBeGreaterThan(0);
    expect(varNames.every((n) => !n.includes('.'))).toBe(true);
  });

  it('covers every token category the design system defines', () => {
    for (const name of ['--color-neutral-900', '--fontSize-md', '--radius-md', '--shadow-md']) {
      expect(css, name).toContain(name);
    }
  });

  // Regression for #158: the studio used to flatten tokens itself and emitted camelCase
  // (`--text-heading-fontSize`). The design system's component CSS consumes kebab-case, so every
  // composite-typography rule fell back to inherited 16px/400 and a reviewed screen did not match
  // what a consumer app renders. Assert the properties the components ACTUALLY read.
  it('defines the composite typography properties the component CSS consumes', () => {
    for (const name of [
      '--text-heading-font-size',
      '--text-heading-font-weight',
      '--text-heading-font-family',
      '--text-body-font-size',
      '--text-title-font-size',
    ]) {
      expect(css, name).toContain(`${name}:`);
    }
  });

  it('never emits camelCase composite (--text-*) properties — they would silently not apply', () => {
    // `--fontSize-*` / `--space-*` are deliberate back-compat aliases for the studio chrome; the
    // composites are what the component CSS reads, so those must be kebab-case.
    const camel = [...css.matchAll(/(--text-[\w-]*[a-z][A-Z][\w-]*):/g)].map((m) => m[1]!);
    expect(camel, `camelCase composite properties leaked: ${camel.join(', ')}`).toEqual([]);
  });

  it('ships the dark-theme block from the design system', () => {
    expect(css).toMatch(/\[data-theme=['"]dark['"]\]|\.dark/);
  });
});
