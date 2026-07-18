import { describe, it, expect } from 'vitest';
import { ingestArtifacts, ingest } from './ingest.js';

const catalog = {
  components: {
    Button: { description: 'A button.', props: { type: 'object' } },
    Card: { description: 'A card.', slots: ['default'], props: { type: 'object' } },
  },
  previews: ['Button', 'Card'],
};
const tokens = { 'color.primary': '#2563eb', 'spacing.4': '16px' };

describe('ingestArtifacts (#90 cloud push path)', () => {
  it('builds the same model from in-memory artifacts as the on-disk path would', () => {
    const model = ingestArtifacts(catalog, tokens);
    expect(model.components.map((c) => c.name)).toEqual(['Button', 'Card']);
    expect(model.components[1]).toMatchObject({ name: 'Card', slots: ['default'] });
    expect(model.tokens.map((t) => t.name)).toEqual(['color.primary', 'spacing.4']);
    expect(model.tokens[0]).toMatchObject({ category: 'color', value: '#2563eb' });
  });

  it('throws (ZodError) on a malformed catalog', () => {
    expect(() => ingestArtifacts({ components: 'nope' }, tokens)).toThrow();
  });

  it('throws (ZodError) on malformed tokens', () => {
    expect(() => ingestArtifacts(catalog, { 'color.primary': 42 })).toThrow();
  });

  it('is exported alongside the on-disk ingest', () => {
    expect(typeof ingest).toBe('function');
  });
});
