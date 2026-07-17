import { describe, it, expect } from 'vitest';
import {
  SpecSchema,
  componentTypesOf,
  toJsonRender,
  fromJsonRender,
  isValidJsonRender,
  type Spec,
} from './index.js';

// A representative nested spec using the example design system's components.
const spec: Spec = {
  root: {
    type: 'PageShell',
    props: { title: 'Checkout' },
    children: [
      {
        type: 'Stack',
        props: { direction: 'vertical', gap: '4' },
        children: [
          { type: 'Text', props: { content: 'Review your order', size: 'lg' }, children: [] },
          {
            type: 'Card',
            props: { title: 'Summary' },
            children: [
              { type: 'Text', props: { content: '1 item', size: 'md' }, children: [] },
              { type: 'Button', props: { label: 'Pay', variant: 'primary' }, children: [] },
            ],
          },
        ],
      },
    ],
  },
};

describe('spec ↔ json-render serialization', () => {
  it('round-trips internal → json-render → internal losslessly', () => {
    expect(fromJsonRender(toJsonRender(spec))).toEqual(spec);
  });

  it('emits a structurally valid json-render spec', () => {
    const jr = toJsonRender(spec);
    expect(isValidJsonRender(jr)).toBe(true);
    // Flat shape: a root id and an elements map keyed by generated ids.
    expect(typeof jr.root).toBe('string');
    expect(jr.elements[jr.root]!.type).toBe('PageShell');
    expect(Object.keys(jr.elements)).toHaveLength(6); // shell, stack, text, card, text, button
  });

  it('assigns deterministic pre-order ids (root first)', () => {
    const jr = toJsonRender(spec);
    expect(jr.root).toBe('el-0');
    // Same input → byte-identical output.
    expect(JSON.stringify(toJsonRender(spec))).toEqual(JSON.stringify(toJsonRender(spec)));
  });

  it('preserves child order through the round-trip', () => {
    const card = fromJsonRender(toJsonRender(spec)).root.children[0]!.children[1]!;
    expect(card.type).toBe('Card');
    expect(card.children.map((c) => c.type)).toEqual(['Text', 'Button']);
  });

  it('throws on a json-render spec that references a missing element', () => {
    expect(() => fromJsonRender({ root: 'nope', elements: {} })).toThrow(/missing element/);
  });

  it('serializes a leaf-only spec (no children key)', () => {
    const leaf: Spec = { root: { type: 'Text', props: { content: 'hi' }, children: [] } };
    const jr = toJsonRender(leaf);
    expect(jr.elements[jr.root]!.children).toBeUndefined();
    expect(fromJsonRender(jr)).toEqual(leaf);
  });
});

describe('SpecSchema', () => {
  it('accepts a well-formed spec', () => {
    expect(() => SpecSchema.parse(spec)).not.toThrow();
  });

  it('rejects a node missing a type', () => {
    expect(() => SpecSchema.parse({ root: { props: {}, children: [] } })).toThrow();
  });

  it('rejects an empty type string', () => {
    expect(() => SpecSchema.parse({ root: { type: '', props: {}, children: [] } })).toThrow();
  });
});

describe('componentTypesOf', () => {
  it('collects distinct component types in first-seen order', () => {
    expect(componentTypesOf(spec)).toEqual(['PageShell', 'Stack', 'Text', 'Card', 'Button']);
  });
});
