import { describe, it, expect } from 'vitest';
import {
  resolveTokens,
  toCssDeclarations,
  toFlatTokens,
  themeCss,
  cssVarName,
  type DtcgDoc,
} from './dtcg.js';

const primitives: DtcgDoc = {
  color: {
    $type: 'color',
    blue: { '500': { $value: '#3b82f6' }, '600': { $value: '#2563eb' } },
    white: { $value: '#ffffff' },
  },
  fontSize: { $type: 'dimension', md: { $value: '16px' } },
  fontWeight: { $type: 'fontWeight', bold: { $value: 700 } },
  lineHeight: { $type: 'number', normal: { $value: 1.5 } },
  fontFamily: { $type: 'fontFamily', sans: { $value: ['Segoe UI', 'sans-serif'] } },
  easing: { $type: 'cubicBezier', standard: { $value: [0.2, 0, 0, 1] } },
};

const semantic: DtcgDoc = {
  primary: {
    $type: 'color',
    default: { $value: '{color.blue.600}' },
    foreground: { $value: '{color.white}' },
  },
  text: {
    $type: 'typography',
    body: {
      $value: {
        fontFamily: '{fontFamily.sans}',
        fontSize: '{fontSize.md}',
        fontWeight: '{fontWeight.bold}',
        lineHeight: '{lineHeight.normal}',
      },
    },
  },
};

describe('DTCG resolveTokens', () => {
  it('resolves scalar aliases to their primitive value', () => {
    const r = resolveTokens([primitives, semantic]);
    expect(r.get('primary.default')?.value).toBe('#2563eb');
    expect(r.get('primary.foreground')?.value).toBe('#ffffff');
  });

  it('resolves composite typography sub-value aliases', () => {
    const r = resolveTokens([primitives, semantic]);
    expect(r.get('text.body')?.value).toEqual({
      fontFamily: ['Segoe UI', 'sans-serif'],
      fontSize: '16px',
      fontWeight: 700,
      lineHeight: 1.5,
    });
  });

  it('throws on an unknown alias and on a cycle', () => {
    expect(() => resolveTokens([{ a: { $value: '{missing.token}' } }])).toThrow(/unknown token/);
    expect(() => resolveTokens([{ a: { $value: '{b}' }, b: { $value: '{a}' } }])).toThrow(/cycle/);
  });
});

describe('CSS emission', () => {
  it('names variables from dotted paths', () => {
    expect(cssVarName('color.blue.500')).toBe('--color-blue-500');
  });

  it('formats scalars, font stacks, and cubic-beziers', () => {
    const decls = toCssDeclarations(resolveTokens([primitives, semantic])).join('\n');
    expect(decls).toContain('--color-blue-600: #2563eb;');
    expect(decls).toContain('--font-family-sans: "Segoe UI", sans-serif;');
    expect(decls).toContain('--easing-standard: cubic-bezier(0.2, 0, 0, 1);');
  });

  it('expands a composite typography token into per-property variables', () => {
    const decls = toCssDeclarations(resolveTokens([primitives, semantic])).join('\n');
    expect(decls).toContain('--text-body-font-size: 16px;');
    expect(decls).toContain('--text-body-font-weight: 700;');
    expect(decls).toContain('--text-body-line-height: 1.5;');
  });

  it('wraps scopes into a stylesheet', () => {
    const css = themeCss({ ':root': resolveTokens([primitives, semantic]) });
    expect(css).toMatch(/^:root \{/);
    expect(css).toContain('--primary-default: #2563eb;');
  });
});

describe('flat tokens artifact (for Lighter ingestion)', () => {
  it('produces a string→string map, expanding composites', () => {
    const flat = toFlatTokens(resolveTokens([primitives, semantic]));
    expect(flat['color.blue.500']).toBe('#3b82f6');
    expect(flat['primary.default']).toBe('#2563eb');
    expect(flat['text.body.fontSize']).toBe('16px');
    expect(Object.values(flat).every((v) => typeof v === 'string')).toBe(true);
  });
});
