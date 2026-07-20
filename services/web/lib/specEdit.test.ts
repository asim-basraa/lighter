import { describe, it, expect } from 'vitest';
import type { Spec, SpecNode } from '@lighter/spec';
import { toJsonRender } from '@lighter/spec/render';
import {
  nodeAt,
  setProp,
  setProps,
  insertChild,
  removeAt,
  moveWithinParent,
  walk,
  elementIdForPath,
  pathForElementId,
  defaultNodeFor,
} from './specEdit.js';

const node = (type: string, props: Record<string, unknown> = {}, children: SpecNode[] = []): SpecNode => ({
  type,
  props,
  children,
});

/** PageShell > [Heading, Grid > [Card > [Button], Card]] */
const spec = (): Spec => ({
  root: node('PageShell', { title: 'Shop' }, [
    node('Heading', { content: 'Hi', level: 2 }),
    node('Grid', { columns: 2 }, [node('Card', { title: 'A' }, [node('Button', { label: 'Buy' })]), node('Card', { title: 'B' })]),
  ]),
});

describe('nodeAt', () => {
  it('addresses by child indices from the root', () => {
    expect(nodeAt(spec(), [])?.type).toBe('PageShell');
    expect(nodeAt(spec(), [0])?.type).toBe('Heading');
    expect(nodeAt(spec(), [1, 0, 0])?.type).toBe('Button');
  });

  it('returns null for a path that does not exist', () => {
    expect(nodeAt(spec(), [9])).toBeNull();
    expect(nodeAt(spec(), [0, 0])).toBeNull();
  });
});

describe('immutability', () => {
  it('never mutates the input spec', () => {
    // The editor keeps the previous spec to fall back on when an edit is rejected, and React needs a
    // changed identity to re-render — a mutation would silently break both.
    const original = spec();
    const snapshot = JSON.stringify(original);
    setProp(original, [0], 'content', 'Changed');
    insertChild(original, [], node('Text', { content: 'x' }));
    removeAt(original, [0]);
    moveWithinParent(original, [0], 1);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe('a stale path is a no-op, never a deletion', () => {
  // The editor holds a selected path across edits. If "not found" and "delete me" are conflated, a
  // stale path deletes whichever ancestor is still reachable — which the author sees as nodes
  // spontaneously reordering or vanishing, with no error anywhere.
  it('leaves the tree untouched when the path does not resolve', () => {
    const original = spec();
    for (const bad of [[9], [0, 0], [1, 0, 5], [1, 9, 0], [0, 1, 2, 3]]) {
      expect(setProp(original, bad, 'label', 'x'), bad.join('.')).toEqual(original);
      expect(setProps(original, bad, { a: 1 }), bad.join('.')).toEqual(original);
      expect(insertChild(original, bad, node('Text')), bad.join('.')).toEqual(original);
      expect(removeAt(original, bad), bad.join('.')).toEqual(original);
    }
  });

  it('does not drop a sibling subtree when a deep path misses', () => {
    const original = spec();
    // [1,0,5] resolves through Grid -> Card, then misses. The Card (and its Button) must survive.
    const next = setProp(original, [1, 0, 5], 'label', 'x');
    expect(nodeAt(next, [1, 0])?.type).toBe('Card');
    expect(nodeAt(next, [1, 0, 0])?.type).toBe('Button');
    expect(nodeAt(next, [1, 1])?.type).toBe('Card');
  });
});

describe('setProp', () => {
  it('sets a prop deep in the tree', () => {
    const next = setProp(spec(), [1, 0, 0], 'label', 'Add to cart');
    expect(nodeAt(next, [1, 0, 0])?.props.label).toBe('Add to cart');
  });

  it('removes a prop when given undefined, so an optional field can be cleared', () => {
    const next = setProp(spec(), [0], 'level', undefined);
    expect('level' in (nodeAt(next, [0])?.props ?? {})).toBe(false);
  });

  it('leaves siblings alone', () => {
    const next = setProp(spec(), [1, 0], 'title', 'Changed');
    expect(nodeAt(next, [1, 1])?.props.title).toBe('B');
  });
});

describe('setProps', () => {
  it('replaces the whole prop bag', () => {
    const next = setProps(spec(), [0], { content: 'New', level: 1 });
    expect(nodeAt(next, [0])?.props).toEqual({ content: 'New', level: 1 });
  });
});

describe('insertChild', () => {
  it('appends by default', () => {
    const next = insertChild(spec(), [1, 1], node('Text', { content: 'in B' }));
    expect(nodeAt(next, [1, 1, 0])?.type).toBe('Text');
  });

  it('inserts at an index', () => {
    const next = insertChild(spec(), [], node('Divider'), 0);
    expect(nodeAt(next, [0])?.type).toBe('Divider');
    expect(nodeAt(next, [1])?.type).toBe('Heading');
  });

  it('clamps an out-of-range index instead of dropping the node', () => {
    const next = insertChild(spec(), [], node('Divider'), 99);
    expect(nodeAt(next, [2])?.type).toBe('Divider');
  });
});

describe('removeAt', () => {
  it('removes and reindexes siblings', () => {
    const next = removeAt(spec(), [0]);
    expect(nodeAt(next, [0])?.type).toBe('Grid');
    expect(nodeAt(next, [1])).toBeNull();
  });

  it('refuses to remove the root — a spec with no root is not a spec', () => {
    const original = spec();
    expect(removeAt(original, [])).toEqual(original);
  });
});

describe('moveWithinParent', () => {
  it('moves a node later and earlier among its siblings', () => {
    const down = moveWithinParent(spec(), [0], 1);
    expect(nodeAt(down, [0])?.type).toBe('Grid');
    expect(nodeAt(down, [1])?.type).toBe('Heading');
    const backUp = moveWithinParent(down, [1], -1);
    expect(nodeAt(backUp, [0])?.type).toBe('Heading');
  });

  it('is a no-op at the edges, so a button can call it unconditionally', () => {
    const original = spec();
    expect(moveWithinParent(original, [0], -1)).toEqual(original);
    expect(moveWithinParent(original, [1], 1)).toEqual(original);
    expect(moveWithinParent(original, [], 1)).toEqual(original);
  });
});

describe('walk', () => {
  it('yields every node in pre-order with its path', () => {
    expect(walk(spec()).map((e) => e.node.type)).toEqual([
      'PageShell',
      'Heading',
      'Grid',
      'Card',
      'Button',
      'Card',
    ]);
    expect(walk(spec()).map((e) => e.path)).toEqual([[], [0], [1], [1, 0], [1, 0, 0], [1, 1]]);
  });
});

describe('element id mapping', () => {
  it('matches the ids json-render actually assigns', () => {
    // This correspondence is what lets a click on the live canvas select the right tree node. If the
    // walk order ever diverged from toJsonRender's numbering, selection would silently pick the
    // wrong element — so assert against the real serializer, not a hand-written expectation.
    const s = spec();
    const rendered = toJsonRender(s) as { elements: Record<string, { type: string }> };
    for (const { path, node: n } of walk(s)) {
      const id = elementIdForPath(s, path)!;
      expect(rendered.elements[id]!.type, `${id} -> ${path.join('.')}`).toBe(n.type);
    }
  });

  it('round-trips path -> id -> path', () => {
    const s = spec();
    for (const { path } of walk(s)) {
      const id = elementIdForPath(s, path)!;
      expect(pathForElementId(s, id)).toEqual(path);
    }
  });

  it('returns null for ids that are not element ids', () => {
    expect(pathForElementId(spec(), 'nope')).toBeNull();
    expect(pathForElementId(spec(), 'el-999')).toBeNull();
  });
});

describe('defaultNodeFor', () => {
  const schema = {
    properties: {
      label: { type: 'string' },
      variant: { type: 'string', enum: ['primary', 'secondary'] },
      columns: { type: 'integer', minimum: 1 },
      wrap: { type: 'boolean' },
      options: { type: 'array' },
    },
    required: ['label', 'variant', 'columns', 'wrap', 'options'],
  };

  it('fills every required prop so an inserted component renders immediately', () => {
    // Inserting something that throws for a missing required prop would make the editor feel broken.
    const created = defaultNodeFor('Button', schema);
    expect(created.props).toEqual({
      label: 'Button',
      variant: 'primary',
      columns: 1,
      wrap: false,
      options: [],
    });
  });

  it('leaves optional props unset rather than guessing', () => {
    const created = defaultNodeFor('Text', {
      properties: { content: { type: 'string' }, tone: { type: 'string', enum: ['muted'] } },
      required: ['content'],
    });
    expect(created.props).toEqual({ content: 'Text' });
  });

  it('starts with no children', () => {
    expect(defaultNodeFor('Card', { properties: {}, required: [] }).children).toEqual([]);
  });
});
