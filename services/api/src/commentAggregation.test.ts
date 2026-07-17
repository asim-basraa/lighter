import { describe, it, expect } from 'vitest';
import type { Comment } from '@lighter/db';
import { aggregateComments } from './commentAggregation.js';

let auto = 0;
const c = (over: Partial<Comment> & { body: string }): Comment => ({
  id: ++auto,
  screenId: 'home',
  version: 1,
  elementId: 'el-0',
  author: null,
  parentId: null,
  createdAt: '2026-07-17 09:00:00',
  ...over,
});

describe('aggregateComments', () => {
  it('groups by version then element, nesting replies under their root', () => {
    const root = c({ id: 10, version: 1, elementId: 'el-1', body: 'root' });
    const flat: Comment[] = [
      root,
      c({ id: 11, version: 1, elementId: 'el-1', parentId: 10, body: 'reply' }),
      c({ id: 12, version: 1, elementId: 'el-2', body: 'other element' }),
      c({ id: 13, version: 2, elementId: 'el-1', body: 'next version' }),
    ];
    const agg = aggregateComments(flat);

    expect(agg.map((v) => v.version)).toEqual([1, 2]);
    const v1 = agg[0]!;
    expect(v1.elements.map((e) => e.elementId)).toEqual(['el-1', 'el-2']);
    // The reply is nested under its root, not a top-level thread.
    expect(v1.elements[0]!.threads).toHaveLength(1);
    expect(v1.elements[0]!.threads[0]!.root.body).toBe('root');
    expect(v1.elements[0]!.threads[0]!.replies.map((r) => r.body)).toEqual(['reply']);
    // v2 keeps its own group.
    expect(agg[1]!.elements[0]!.threads[0]!.root.body).toBe('next version');
  });

  it('returns an empty array for no comments', () => {
    expect(aggregateComments([])).toEqual([]);
  });

  it('keeps multiple threads on the same element in order', () => {
    const flat: Comment[] = [
      c({ id: 1, elementId: 'el-0', body: 'first' }),
      c({ id: 2, elementId: 'el-0', body: 'second' }),
    ];
    const threads = aggregateComments(flat)[0]!.elements[0]!.threads;
    expect(threads.map((t) => t.root.body)).toEqual(['first', 'second']);
  });
});
