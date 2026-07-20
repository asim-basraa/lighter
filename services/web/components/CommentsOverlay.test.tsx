// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CommentsOverlay } from './CommentsOverlay.js';
import type { CommentRecord } from '../lib/comments.js';
import type { SpecElement } from '../lib/specElements.js';

afterEach(cleanup);

const elements: SpecElement[] = [
  { id: 'el-0', type: 'PageShell' },
  { id: 'el-1', type: 'Button' },
];

const comment = (id: number, body: string): CommentRecord => ({
  id,
  screenId: 'storefront',
  version: 1,
  elementId: 'el-1',
  body,
  author: 'Dana',
  parentId: null,
  createdAt: '2026-07-20T00:00:00.000Z',
});

describe('CommentsOverlay (#160)', () => {
  it('starts closed so the screen gets the full viewport', () => {
    render(
      <CommentsOverlay
        token="t"
        elements={elements}
        initialComments={[comment(1, 'Make it secondary')]}
      />,
    );
    // The toggle is present…
    expect(screen.getByRole('button', { name: /show comments/i })).toBeTruthy();
    // …but no comment content is on screen yet.
    expect(screen.queryByText('Make it secondary')).toBeNull();
  });

  it('shows the comment count on the toggle', () => {
    render(
      <CommentsOverlay
        token="t"
        elements={elements}
        initialComments={[comment(1, 'one'), comment(2, 'two')]}
      />,
    );
    expect(screen.getByRole('button', { name: /show comments, 2/i })).toBeTruthy();
  });

  it('opens the panel with the existing threads, and closes again', () => {
    render(
      <CommentsOverlay
        token="t"
        elements={elements}
        initialComments={[comment(1, 'Make it secondary')]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /show comments/i }));
    expect(screen.getByText('Make it secondary')).toBeTruthy();
    // The composer comes along, so a reviewer can anchor a new comment while the panel is open.
    // Exactly one landmark carries the name — the overlay's <aside>; the nested panel stays unnamed
    // so screen readers don't announce the same landmark twice.
    expect(screen.getByRole('complementary', { name: /review comments/i })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /review comments/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /close comments/i }));
    expect(screen.queryByText('Make it secondary')).toBeNull();
  });

  it('still opens when there are no comments (so a first one can be left)', () => {
    render(<CommentsOverlay token="t" elements={elements} initialComments={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /show comments/i }));
    expect(screen.getByText(/no comments yet/i)).toBeTruthy();
  });
});
