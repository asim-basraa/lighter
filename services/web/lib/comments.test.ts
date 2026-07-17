import { describe, it, expect } from 'vitest';
import { loadComments, type CommentRecord } from './comments.js';

const rows: CommentRecord[] = [
  {
    id: 1,
    screenId: 'checkout',
    version: 2,
    elementId: 'el-1',
    body: 'Tighten spacing',
    author: 'Dana',
    parentId: null,
    createdAt: '2026-07-17 09:30:00',
  },
];

describe('loadComments', () => {
  it('returns the version comments on success', async () => {
    const loaded = await loadComments(() => new Response(JSON.stringify(rows), { status: 200 }));
    expect(loaded.error).toBeNull();
    expect(loaded.comments).toEqual(rows);
  });

  it('folds a failure into an empty list + error (never throws)', async () => {
    const loaded = await loadComments(() => new Response('', { status: 500 }));
    expect(loaded.comments).toEqual([]);
    expect(loaded.error).toMatch(/500/);
  });
});
