import { describe, it, expect } from 'vitest';
import { TokensArtifact } from '@lighter/ingestion';
import { dtcgToTokens } from './dtcg.js';

describe('dtcgToTokens (#121 DTCG token ingestion)', () => {
  it('flattens groups + tokens into dotted names, ignoring metadata', () => {
    const tokens = dtcgToTokens({
      color: {
        $type: 'color',
        primary: { $value: '#2563eb', $description: 'brand' },
        blue: { 500: { $value: '#3b82f6' } },
      },
      spacing: { 4: { $type: 'dimension', $value: '16px' } },
    });
    expect(tokens).toEqual({
      'color.primary': '#2563eb',
      'color.blue.500': '#3b82f6',
      'spacing.4': '16px',
    });
    // The result IS a valid Lighter tokens artifact.
    expect(() => TokensArtifact.parse(tokens)).not.toThrow();
  });

  it('resolves aliases, including multi-hop', () => {
    const tokens = dtcgToTokens({
      color: {
        base: { $value: '#111' },
        primary: { $value: '{color.base}' },
        cta: { $value: '{color.primary}' },
      },
    });
    expect(tokens['color.primary']).toBe('#111');
    expect(tokens['color.cta']).toBe('#111');
  });

  it('stringifies numbers and composite/array values', () => {
    const tokens = dtcgToTokens({
      font: { weight: { bold: { $value: 700 } }, family: { sans: { $value: ['Inter', 'system-ui'] } } },
    });
    expect(tokens['font.weight.bold']).toBe('700');
    expect(tokens['font.family.sans']).toBe(JSON.stringify(['Inter', 'system-ui']));
  });

  it('fails loudly on an unknown or circular alias', () => {
    expect(() => dtcgToTokens({ a: { $value: '{b.missing}' } })).toThrow(/unknown token/);
    expect(() =>
      dtcgToTokens({ x: { $value: '{y}' }, y: { $value: '{x}' } }),
    ).toThrow(/circular/);
  });

  it('later docs override earlier ones (theme layering)', () => {
    const tokens = dtcgToTokens(
      { color: { bg: { $value: '#fff' } } },
      { color: { bg: { $value: '#000' } } },
    );
    expect(tokens['color.bg']).toBe('#000');
  });
});
