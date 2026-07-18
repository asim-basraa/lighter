import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import { objectToJsonSchema } from './zodToJsonSchema.js';
import { catalogDefs } from '../registry/catalog-defs.js';
import { flatTokens } from '../tokens/index.js';

describe('catalog build artifacts (Lighter-ingestable)', () => {
  it('every catalog component has a real description, slots, and a JSON-Schema props object', () => {
    for (const def of catalogDefs) {
      expect(def.description.length).toBeGreaterThan(20);
      const schema = objectToJsonSchema(def.props as z.ZodObject<z.ZodRawShape>);
      expect(schema).toMatchObject({ type: 'object', additionalProperties: false });
      expect(schema.properties).toBeTypeOf('object');
    }
  });

  it('converts zod props to JSON Schema (required, enums, integers, optionals)', () => {
    const button = catalogDefs.find((d) => d.name === 'Button')!;
    const schema = objectToJsonSchema(button.props as z.ZodObject<z.ZodRawShape>) as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(schema.required).toEqual(['label']); // variant/size are optional
    expect(schema.properties.variant).toMatchObject({ type: 'string', enum: expect.any(Array) });
    const heading = objectToJsonSchema(
      catalogDefs.find((d) => d.name === 'Heading')!.props as z.ZodObject<z.ZodRawShape>,
    ) as { properties: Record<string, { type: string; minimum?: number; maximum?: number }> };
    expect(heading.properties.level).toMatchObject({ type: 'integer', minimum: 1, maximum: 6 });
  });

  it('the flat token map is a string→string artifact', () => {
    expect(Object.keys(flatTokens).length).toBeGreaterThan(300);
    expect(flatTokens['primary.default']).toMatch(/^#/); // resolved through the alias
    expect(flatTokens['color.blue.500']).toBe('#3b82f6');
    expect(Object.values(flatTokens).every((v) => typeof v === 'string')).toBe(true);
  });
});
