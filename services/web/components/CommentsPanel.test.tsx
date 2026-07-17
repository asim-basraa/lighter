// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import type { SpecElement } from '../lib/specElements.js';
import type { CommentRecord } from '../lib/comments.js';
import { CommentsPanel } from './CommentsPanel.js';

afterEach(cleanup);

const elements: SpecElement[] = [
  { id: 'el-0', type: 'PageShell' },
  { id: 'el-1', type: 'Button' },
];

const existing: CommentRecord[] = [
  {
    id: 1,
    screenId: 'checkout',
    version: 2,
    elementId: 'el-1',
    body: 'Should this be secondary?',
    author: 'Dana',
    createdAt: '2026-07-17 09:30:00',
  },
];

describe('CommentsPanel', () => {
  it('lists existing comments with their element anchor', () => {
    render(<CommentsPanel token="tok" elements={elements} initialComments={existing} />);
    const list = screen.getByRole('list', { name: /comments/i });
    expect(within(list).getByText('Should this be secondary?')).toBeTruthy();
    // The comment shows which element it is anchored to (id + type), not pixels.
    expect(within(list).getByText(/el-1/)).toBeTruthy();
    expect(within(list).getByText(/Button/)).toBeTruthy();
  });

  it('signals a failed load instead of showing an empty state', () => {
    render(<CommentsPanel token="tok" elements={elements} initialComments={[]} loadError="boom" />);
    expect(screen.getByText(/couldn.t load existing comments/i)).toBeTruthy();
    expect(screen.queryByText(/no comments yet/i)).toBeNull();
  });

  it('submits a new comment for the chosen element and shows it', async () => {
    const submit = vi.fn(
      async (_token: string, input: { elementId: string; body: string; author?: string }) =>
        ({
          id: 2,
          screenId: 'checkout',
          version: 2,
          elementId: input.elementId,
          body: input.body,
          author: input.author ?? null,
          createdAt: '2026-07-17 10:00:00',
        }) satisfies CommentRecord,
    );
    render(<CommentsPanel token="tok" elements={elements} initialComments={[]} submit={submit} />);

    fireEvent.change(screen.getByLabelText('Element'), { target: { value: 'el-1' } });
    fireEvent.change(screen.getByLabelText('Comment'), {
      target: { value: 'Add a loading state' },
    });
    fireEvent.click(screen.getByRole('button', { name: /post/i }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ elementId: 'el-1', body: 'Add a loading state' }),
    );
    // The new comment appears in the list.
    expect(await screen.findByText('Add a loading state')).toBeTruthy();
  });

  it('surfaces a submit error and keeps the draft', async () => {
    const submit = vi.fn(async () => {
      throw new Error('That element is no longer part of this version.');
    });
    render(<CommentsPanel token="tok" elements={elements} initialComments={[]} submit={submit} />);
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'keep me' } });
    fireEvent.click(screen.getByRole('button', { name: /post/i }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/no longer part/i);
    // Draft is preserved so the reviewer doesn't lose their text.
    expect((screen.getByLabelText('Comment') as HTMLTextAreaElement).value).toBe('keep me');
  });
});
