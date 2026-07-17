import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

  it('round-trips rich props losslessly (nested objects, arrays, null, empty)', () => {
    const rich: Spec = {
      root: {
        type: 'Card',
        props: {
          title: null,
          meta: { tags: ['a', 'b'], count: 2, nested: { deep: true } },
          items: [1, 'two', { three: 3 }],
          empty: {},
        },
        children: [{ type: 'Text', props: {}, children: [] }],
      },
    };
    expect(fromJsonRender(toJsonRender(rich))).toEqual(rich);
  });

  it('does not alias prop objects across the boundary', () => {
    const src: Spec = { root: { type: 'Text', props: { content: 'x' }, children: [] } };
    const jr = toJsonRender(src);
    (jr.elements[jr.root]!.props as Record<string, unknown>).content = 'mutated';
    expect(src.root.props.content).toBe('x'); // internal spec untouched
  });

  it('refuses to serialize a prop that collides with a json-render reserved key', () => {
    const bad: Spec = { root: { type: 'Modal', props: { visible: true }, children: [] } };
    expect(() => toJsonRender(bad)).toThrow(/reserved element field/);
  });

  it('fails loudly deserializing element-level fields it cannot represent', () => {
    expect(() =>
      fromJsonRender({ root: 'a', elements: { a: { type: 'T', props: {}, visible: false } } }),
    ).toThrow(/cannot represent/);
  });

  it("maps json-render top-level state to the spec's mock data", () => {
    const spec = fromJsonRender({
      root: 'a',
      elements: { a: { type: 'T', props: {} } },
      state: { user: { name: 'Alice' } },
    });
    expect(spec.data).toEqual({ user: { name: 'Alice' } });
  });

  it('serializes mock data to json-render state and round-trips it losslessly', () => {
    const withData: Spec = {
      root: { type: 'Text', props: { content: 'Hi' }, children: [] },
      data: { user: { name: 'Alice' }, items: [1, 2, 3] },
    };
    const jr = toJsonRender(withData);
    expect(jr.state).toEqual(withData.data);
    expect(fromJsonRender(jr)).toEqual(withData);
  });

  it('omits state when the spec has no mock data', () => {
    const jr = toJsonRender({ root: { type: 'Text', props: {}, children: [] } });
    expect(jr.state).toBeUndefined();
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

  it('defaults children to [] for a hand-edited leaf that omits it', () => {
    const parsed = SpecSchema.parse({ root: { type: 'Text', props: { content: 'hi' } } });
    expect(parsed.root.children).toEqual([]);
  });
});

describe('json-render isolation (AC3)', () => {
  it('is the only package module that imports @json-render/core', () => {
    // Walk every .ts under packages/ and services/ and assert the json-render import lives in
    // exactly one file — the serializer boundary. Locks the isolation invariant.
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', 'dist', '.next', 'coverage'].includes(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (
          (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
          !entry.name.includes('.test.')
        ) {
          // Match a real import of the package, not an incidental mention.
          if (/from ['"]@json-render\/core['"]/.test(readFileSync(full, 'utf8'))) {
            offenders.push(full.slice(root.length));
          }
        }
      }
    };
    for (const top of ['packages', 'services']) walk(join(root, top));
    expect(offenders).toEqual(['packages/spec/src/json-render.ts']);
  });
});

describe('componentTypesOf', () => {
  it('collects distinct component types in first-seen order', () => {
    expect(componentTypesOf(spec)).toEqual(['PageShell', 'Stack', 'Text', 'Card', 'Button']);
  });
});
