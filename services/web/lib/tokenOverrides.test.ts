import { describe, it, expect } from 'vitest';
import { buildTokenCss, DEFAULT_EDITS } from './tokenOverrides.js';

describe('buildTokenCss', () => {
  it('emits nothing when nothing is edited, so a cleared sheet restores the app tokens', () => {
    expect(buildTokenCss(DEFAULT_EDITS)).toBe('');
    expect(buildTokenCss({})).toBe('');
  });

  it('out-ranks the design system theme rules, not just :root', () => {
    // The DS ships `:root[data-theme="dark"], .dark { --primary-default: ... }` at specificity
    // (0,2,0). A plain `:root` override (0,1,0) LOSES to it regardless of source order, so token
    // edits silently do nothing for anyone in dark mode. Caught live: the preview appeared broken
    // only because the browser was in dark mode.
    const css = buildTokenCss({ primary: '#ff0000' });
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain('.dark');
  });

  it('derives the interaction states from the brand colour', () => {
    const css = buildTokenCss({ primary: '#ff0000' });
    expect(css).toContain('--primary-default: #ff0000;');
    // Without derived hover/active a previewed button looks flat and state-less.
    expect(css).toContain('--primary-hover:');
    expect(css).toContain('--primary-active:');
    expect(css).toContain('--ring-default: #ff0000;');
  });

  it('scales spacing off the design system values, not hard-coded numbers', () => {
    const css = buildTokenCss({ spaceScale: 2 });
    // spacing.4 is 16px in the token set, so a 2x density lands on 32px.
    expect(css).toContain('--spacing-4: 32px;');
  });

  it('scales type', () => {
    expect(buildTokenCss({ fontScale: 2 })).toContain('--font-size-md: 32px;');
  });

  it('leaves unscalable values alone', () => {
    const css = buildTokenCss({ radiusScale: 2 });
    // 0px stays 0 and 9999px (radius-full) must not become 19998px and break pill shapes.
    expect(css).not.toContain('--radius-none:');
    expect(css).not.toContain('19998px');
    expect(css).toContain('--radius-md: 12px;');
  });

  it('omits a group entirely when its scale is 1', () => {
    const css = buildTokenCss({ primary: '#000', spaceScale: 1 });
    expect(css).not.toContain('--spacing-');
  });
});
