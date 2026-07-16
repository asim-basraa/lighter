import { describe, it, expect } from 'vitest';
import { propsToRows } from './propsSchema.js';

// Schemas exactly as lighter-example emits them (zod-to-json-schema: nullable enums as anyOf).
const buttonProps = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    variant: { anyOf: [{ type: 'string', enum: ['primary', 'secondary'] }, { type: 'null' }] },
  },
  required: ['label', 'variant'],
  additionalProperties: false,
};

const stackProps = {
  type: 'object',
  properties: {
    direction: { anyOf: [{ type: 'string', enum: ['vertical', 'horizontal'] }, { type: 'null' }] },
    gap: { anyOf: [{ type: 'string', enum: ['1', '2', '4', '6', '8'] }, { type: 'null' }] },
  },
  required: ['direction', 'gap'],
  additionalProperties: false,
};

function row(props: Record<string, unknown>, name: string) {
  return propsToRows(props).find((r) => r.name === name)!;
}

describe('propsToRows', () => {
  it('derives one row per property, in schema order', () => {
    expect(propsToRows(buttonProps).map((r) => r.name)).toEqual(['label', 'variant']);
  });

  it('reports a plain scalar type', () => {
    expect(row(buttonProps, 'label').type).toBe('string');
  });

  it('renders a nullable enum as a union of its quoted values plus null', () => {
    expect(row(buttonProps, 'variant').type).toBe('"primary" | "secondary" | null');
    expect(row(stackProps, 'gap').type).toBe('"1" | "2" | "4" | "6" | "8" | null');
  });

  it('marks required vs optional from the schema, not by hand', () => {
    expect(row(buttonProps, 'label').required).toBe(true);
    const optional = {
      type: 'object',
      properties: { a: { type: 'string' } },
      required: [],
    };
    expect(row(optional, 'a').required).toBe(false);
  });

  it('surfaces a schema default, or null when there is none', () => {
    expect(row(buttonProps, 'label').default).toBeNull();
    const withDefault = {
      type: 'object',
      properties: { size: { type: 'string', default: 'md' } },
      required: [],
    };
    expect(row(withDefault, 'size').default).toBe('"md"');
  });

  it('also understands the type-array nullable form (fixture/JSON-Schema draft style)', () => {
    const merged = {
      type: 'object',
      properties: { title: { type: ['string', 'null'] } },
      required: ['title'],
    };
    expect(row(merged, 'title').type).toBe('string | null');
  });

  it('returns no rows for a schema with no properties', () => {
    expect(propsToRows({ type: 'object' })).toEqual([]);
    expect(propsToRows({})).toEqual([]);
  });
});
