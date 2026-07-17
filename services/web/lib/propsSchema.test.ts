import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

describe('propsToRows against a real committed catalog artifact', () => {
  // Pins the UI to an actual ingestion artifact so a future change to the emitter's JSON Schema
  // (e.g. a different null representation) can't silently drift the props view unnoticed.
  const catalog = JSON.parse(
    readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        '..',
        'packages',
        'ingestion',
        'fixtures',
        'example-ds',
        'artifacts',
        'catalog.json',
      ),
      'utf8',
    ),
  ) as { components: Record<string, { props: unknown; required?: string[] }> };

  it('derives a labeled row for every prop of every component (never "unknown")', () => {
    for (const [name, entry] of Object.entries(catalog.components)) {
      const rows = propsToRows(entry.props);
      expect(rows.length, `${name} has rows`).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.type, `${name}.${row.name} type`).not.toBe('unknown');
        expect(row.type.length).toBeGreaterThan(0);
      }
    }
  });

  it("reads Button's label as a required string and variant as a nullable enum", () => {
    const rows = propsToRows(catalog.components.Button!.props);
    const label = rows.find((r) => r.name === 'label')!;
    const variant = rows.find((r) => r.name === 'variant')!;
    expect(label.type).toBe('string');
    expect(label.required).toBe(true);
    expect(variant.type).toContain('null');
    expect(variant.type).toContain('primary');
  });
});
