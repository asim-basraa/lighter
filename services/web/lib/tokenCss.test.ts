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
});
