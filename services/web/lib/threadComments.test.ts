import { describe, it, expect } from 'vitest';
import { threadComments } from './threadComments.js';
import type { CommentRecord } from './comments.js';

const c = (id: number, parentId: number | null, body: string): CommentRecord => ({
  id,
  screenId: 'home',
  version: 1,
  elementId: 'el-0',
  body,
  author: null,
  parentId,
  createdAt: '2026-07-17 09:00:00',
});

describe('threadComments', () => {
  it('groups replies under their root, preserving order', () => {
    const flat = [
      c(1, null, 'root A'),
      c(2, 1, 'reply A1'),
      c(3, null, 'root B'),
      c(4, 1, 'reply A2'),
    ];
    const threads = threadComments(flat);
    expect(threads.map((t) => t.root.body)).toEqual(['root A', 'root B']);
    expect(threads[0]!.replies.map((r) => r.body)).toEqual(['reply A1', 'reply A2']);
    expect(threads[1]!.replies).toEqual([]);
  });

  it('drops an orphan reply whose parent is absent (never crashes)', () => {
    const threads = threadComments([c(2, 99, 'orphan'), c(1, null, 'root')]);
    expect(threads.map((t) => t.root.body)).toEqual(['root']);
    expect(threads[0]!.replies).toEqual([]);
  });
});
