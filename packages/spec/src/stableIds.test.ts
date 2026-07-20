import { describe, it, expect } from 'vitest';
import {
  SpecSchema,
  ensureIds,
  newNodeId,
  DuplicateIdError,
  DuplicateNameError,
  type RawSpec,
} from './spec.js';
import { toJsonRender, fromJsonRender } from './json-render.js';

const legacy: RawSpec = {
  root: {
    type: 'PageShell',
    props: { title: 'Checkout' },
    children: [
      { type: 'Heading', props: { content: 'Review' }, children: [] },
      {
        type: 'Card',
        props: { title: 'Summary' },
        children: [{ type: 'Button', props: { label: 'Pay' }, children: [] }],
      },
    ],
  },
};

describe('ensureIds — migration (#184)', () => {
  it('gives every node the id it previously serialised to, so existing anchors survive', () => {
    // Before #184 ids were assigned `el-0, el-1, …` in pre-order at serialize time, and comments
    // anchor to those. Migration must reproduce exactly that numbering or every stored comment
    // silently jumps to a different element.
    const migrated = ensureIds(legacy);
    expect(migrated.root.id).toBe('el-0');
    expect(migrated.root.children[0]!.id).toBe('el-1');
    expect(migrated.root.children[1]!.id).toBe('el-2');
    expect(migrated.root.children[1]!.children[0]!.id).toBe('el-3');
  });

  it('is idempotent', () => {
    const once = ensureIds(legacy);
    const twice = ensureIds(once);
    expect(twice).toEqual(once);
  });

  it('keeps ids already present', () => {
    const migrated = ensureIds({
      root: { id: 'keep-me', type: 'Text', props: {}, children: [] },
    });
    expect(migrated.root.id).toBe('keep-me');
  });

  it('rejects duplicate ids rather than silently merging two elements', () => {
    expect(() =>
      ensureIds({
        root: {
          id: 'dup',
          type: 'PageShell',
          props: {},
          children: [{ id: 'dup', type: 'Text', props: {}, children: [] }],
        },
      }),
    ).toThrow(DuplicateIdError);
  });

  it('rejects duplicate slot names', () => {
    expect(() =>
      ensureIds({
        root: {
          id: 'a',
          name: 'FORM',
          type: 'PageShell',
          props: {},
          children: [{ id: 'b', name: 'FORM', type: 'Card', props: {}, children: [] }],
        },
      }),
    ).toThrow(DuplicateNameError);
  });

  it('preserves slot names', () => {
    const migrated = ensureIds({
      root: { id: 'a', name: 'HERO', type: 'Card', props: {}, children: [] },
    });
    expect(migrated.root.name).toBe('HERO');
  });
});

describe('SpecSchema — parsing IS the migration', () => {
  it('assigns ids when parsing a spec that has none', () => {
    const parsed = SpecSchema.parse(legacy);
    expect(parsed.root.id).toBe('el-0');
  });

  it('rejects a spec whose declared ids collide', () => {
    expect(() =>
      SpecSchema.parse({
        root: {
          id: 'x',
          type: 'PageShell',
          props: {},
          children: [{ id: 'x', type: 'Text', props: {}, children: [] }],
        },
      }),
    ).toThrow(DuplicateIdError);
  });
});

describe('the bug this fixes — inserting must not renumber', () => {
  it('leaves every existing id untouched when a node is inserted above it', () => {
    // THE regression this whole slice exists for. Before #184, inserting a node at the top shifted
    // every id after it, so a comment anchored to the Button silently moved to a different element.
    const before = SpecSchema.parse(legacy);
    const buttonId = before.root.children[1]!.children[0]!.id;

    const after: typeof before = {
      ...before,
      root: {
        ...before.root,
        children: [
          { id: newNodeId(), type: 'Divider', props: {}, children: [] },
          ...before.root.children,
        ],
      },
    };

    // The Button moved from index 1 to index 2 in pre-order, but its identity did not change.
    expect(after.root.children[2]!.children[0]!.id).toBe(buttonId);

    // And the rendered DOM key it carries is the same, which is what comments anchor to.
    const renderedBefore = toJsonRender(before);
    const renderedAfter = toJsonRender(after);
    expect(renderedBefore.elements[buttonId]!.type).toBe('Button');
    expect(renderedAfter.elements[buttonId]!.type).toBe('Button');
  });

  it('generates new ids that cannot collide with migrated positional ones', () => {
    // Legacy ids are `el-<digits>`; a generated id must never take that form or a fresh node could
    // collide with a migrated one.
    for (let i = 0; i < 200; i += 1) {
      expect(newNodeId()).not.toMatch(/^el-\d+$/);
    }
    expect(new Set(Array.from({ length: 500 }, newNodeId)).size).toBe(500);
  });
});

describe('json-render round-trip carries identity', () => {
  it('keys elements by the node id and restores it', () => {
    const spec = SpecSchema.parse(legacy);
    const jr = toJsonRender(spec);
    expect(Object.keys(jr.elements).sort()).toEqual(['el-0', 'el-1', 'el-2', 'el-3']);
    expect(fromJsonRender(jr)).toEqual(spec);
  });

  it('round-trips generated ids too, not just migrated ones', () => {
    const spec = SpecSchema.parse({
      root: { id: newNodeId(), type: 'Card', props: {}, children: [] },
    });
    expect(fromJsonRender(toJsonRender(spec))).toEqual(spec);
  });
});
