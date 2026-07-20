import { describe, it, expect } from 'vitest';
import { controlsFor, coerce, display, type PropControl } from './propControls.js';

/** The real Button schema as the catalog emits it. */
const buttonSchema = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    variant: { type: 'string', enum: ['primary', 'secondary', 'outline'] },
    size: { type: 'string', enum: ['sm', 'md', 'lg'] },
    loading: { type: 'boolean' },
  },
  required: ['label'],
  additionalProperties: false,
};

describe('controlsFor', () => {
  it('derives a control per prop, in schema order', () => {
    expect(controlsFor(buttonSchema).map((c) => `${c.name}:${c.kind}`)).toEqual([
      'label:text',
      'variant:enum',
      'size:enum',
      'loading:boolean',
    ]);
  });

  it('marks required props', () => {
    const controls = controlsFor(buttonSchema);
    expect(controls.find((c) => c.name === 'label')!.required).toBe(true);
    expect(controls.find((c) => c.name === 'variant')!.required).toBe(false);
  });

  it('gives an OPTIONAL enum a blank choice, so a value can be unset again', () => {
    // Without this, choosing a variant once would be irreversible from the panel.
    const variant = controlsFor(buttonSchema).find((c) => c.name === 'variant')!;
    expect(variant.options).toEqual(['', 'primary', 'secondary', 'outline']);
  });

  it('does not offer a blank choice for a REQUIRED enum', () => {
    const controls = controlsFor({
      properties: { status: { type: 'string', enum: ['info', 'error'] } },
      required: ['status'],
    });
    expect(controls[0]!.options).toEqual(['info', 'error']);
  });

  it('carries numeric bounds through', () => {
    const controls = controlsFor({
      properties: { columns: { type: 'integer', minimum: 1, maximum: 6 } },
      required: [],
    });
    expect(controls[0]).toMatchObject({ kind: 'number', min: 1, max: 6 });
  });

  it('uses a JSON control for structured props rather than a lossy bespoke builder', () => {
    const controls = controlsFor({
      properties: { options: { type: 'array' } },
      required: ['options'],
    });
    expect(controls[0]!.kind).toBe('json');
  });

  it('uses a textarea for long-form text props', () => {
    const controls = controlsFor({
      properties: { message: { type: 'string' }, label: { type: 'string' } },
      required: [],
    });
    expect(controls.map((c) => c.kind)).toEqual(['textarea', 'text']);
  });

  it('unwraps both nullable shapes a catalog can emit', () => {
    const anyOf = controlsFor({
      properties: { title: { anyOf: [{ type: 'string' }, { type: 'null' }] } },
      required: [],
    });
    expect(anyOf[0]).toMatchObject({ kind: 'text', nullable: true });

    const typeArray = controlsFor({
      properties: { title: { type: ['string', 'null'] } },
      required: [],
    });
    expect(typeArray[0]).toMatchObject({ kind: 'text', nullable: true });
  });

  it('returns nothing for a missing or malformed schema instead of throwing', () => {
    expect(controlsFor(undefined)).toEqual([]);
    expect(controlsFor('nope')).toEqual([]);
    expect(controlsFor({})).toEqual([]);
  });
});

describe('coerce', () => {
  const control = (over: Partial<PropControl>): PropControl => ({
    name: 'x',
    kind: 'text',
    required: false,
    nullable: false,
    ...over,
  });

  it('removes an optional prop when cleared', () => {
    expect(coerce(control({ kind: 'text' }), '')).toBeUndefined();
  });

  it('keeps an empty string for a required prop rather than deleting it', () => {
    // Deleting a required prop would make the spec fail catalog validation on push, with the panel
    // showing nothing wrong.
    expect(coerce(control({ kind: 'text', required: true }), '')).toBe('');
  });

  it('parses numbers and rejects nonsense', () => {
    expect(coerce(control({ kind: 'number' }), '3')).toBe(3);
    expect(coerce(control({ kind: 'number' }), 'abc')).toBeUndefined();
  });

  it('parses JSON, and returns undefined on a parse error so the caller can keep the old value', () => {
    expect(coerce(control({ kind: 'json' }), '[{"a":1}]')).toEqual([{ a: 1 }]);
    expect(coerce(control({ kind: 'json' }), '[{oops')).toBeUndefined();
  });

  it('passes booleans through', () => {
    expect(coerce(control({ kind: 'boolean' }), true)).toBe(true);
    expect(coerce(control({ kind: 'boolean' }), false)).toBe(false);
  });
});

describe('display', () => {
  it('renders scalars plainly and structures as pretty JSON', () => {
    expect(display('hi')).toBe('hi');
    expect(display(3)).toBe('3');
    expect(display(true)).toBe('true');
    expect(display(undefined)).toBe('');
    expect(display(null)).toBe('');
    expect(display([{ a: 1 }])).toBe('[\n  {\n    "a": 1\n  }\n]');
  });
});
