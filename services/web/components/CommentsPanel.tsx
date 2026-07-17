'use client';

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import type { SpecElement } from '../lib/specElements.js';
import { postComment, type CommentRecord, type NewComment } from '../lib/comments.js';
import { formatDeployedAt } from '../lib/deployedAt.js';

/** Injectable so tests drive the panel without a network call; defaults to the real same-origin POST. */
type SubmitFn = (token: string, input: NewComment) => Promise<CommentRecord>;

/**
 * The reviewer comment panel on a deployed mock. Lists comments anchored to spec elements and lets a
 * reviewer (no account) leave a new one against a chosen element. Anchors are the structural json-
 * render ids (`el-N`) — stable across layout changes — shown with their component type so the choice
 * is legible. New comments are appended locally on success, so the thread updates without a reload.
 */
export function CommentsPanel({
  token,
  elements,
  initialComments,
  loadError = null,
  submit = postComment,
}: {
  token: string;
  elements: SpecElement[];
  initialComments: CommentRecord[];
  /** Set when the initial comment load failed, so the panel says so instead of "no comments yet". */
  loadError?: string | null;
  submit?: SubmitFn;
}) {
  const [comments, setComments] = useState(initialComments);
  const [elementId, setElementId] = useState(elements[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [author, setAuthor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const typeOf = useMemo(() => new Map(elements.map((e) => [e.id, e.type])), [elements]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (body.trim().length === 0 || elementId.length === 0) return;
    setPending(true);
    setError(null);
    try {
      const created = await submit(token, {
        elementId,
        body: body.trim(),
        author: author.trim() || undefined,
      });
      setComments((prev) => [...prev, created]);
      setBody(''); // keep the element + name for the next comment
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your comment.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section style={panel} aria-label="Review comments">
      <h2 style={heading}>Comments</h2>

      {loadError ? (
        <p style={muted}>Couldn’t load existing comments. You can still leave a new one below.</p>
      ) : comments.length === 0 ? (
        <p style={muted}>No comments yet. Choose an element below to leave the first.</p>
      ) : (
        <ul role="list" aria-label="Comments" style={list}>
          {comments.map((c) => (
            <li key={c.id} style={item}>
              <p style={itemBody}>{c.body}</p>
              <p style={meta}>
                <span style={anchor}>
                  {c.elementId}
                  {typeOf.get(c.elementId) ? ` · ${typeOf.get(c.elementId)}` : ''}
                </span>
                {' · '}
                {c.author ?? 'Anonymous'}
                {' · '}
                {formatDeployedAt(c.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} style={form}>
        <label style={field}>
          Element
          <select value={elementId} onChange={(e) => setElementId(e.target.value)} style={control}>
            {elements.map((el) => (
              <option key={el.id} value={el.id}>
                {el.id} · {el.type}
              </option>
            ))}
          </select>
        </label>
        <label style={field}>
          Comment
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            style={control}
            placeholder="What should change?"
          />
        </label>
        <label style={field}>
          Your name (optional)
          <input value={author} onChange={(e) => setAuthor(e.target.value)} style={control} />
        </label>
        {error ? (
          <p role="alert" style={errorText}>
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending || body.trim().length === 0} style={button}>
          {pending ? 'Posting…' : 'Post comment'}
        </button>
      </form>
    </section>
  );
}

const panel: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  padding: 'var(--space-6)',
  borderLeft: '1px solid var(--color-neutral-300)',
  background: 'var(--color-neutral-50)',
  minWidth: 300,
  maxWidth: 380,
};

const heading: CSSProperties = {
  margin: 0,
  fontSize: 'var(--fontSize-lg)',
  color: 'var(--color-neutral-900)',
};

const list: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: 'var(--space-3)',
};
const item: CSSProperties = {
  padding: 'var(--space-3)',
  background: 'var(--color-neutral-100)',
  borderRadius: 'var(--radius-md)',
};
const itemBody: CSSProperties = { margin: 0, color: 'var(--color-neutral-900)' };
const meta: CSSProperties = {
  margin: '4px 0 0',
  fontSize: 'var(--fontSize-xs)',
  color: 'var(--color-neutral-500)',
};
const anchor: CSSProperties = { fontFamily: 'monospace', color: 'var(--color-blue-700)' };

const form: CSSProperties = { display: 'grid', gap: 'var(--space-3)' };
const field: CSSProperties = {
  display: 'grid',
  gap: '4px',
  fontSize: 'var(--fontSize-sm)',
  color: 'var(--color-neutral-700)',
};
const control: CSSProperties = {
  padding: 'var(--space-2)',
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-sm)',
  font: 'inherit',
};
const button: CSSProperties = {
  padding: 'var(--space-2) var(--space-4)',
  background: 'var(--color-blue-700)',
  color: 'var(--color-neutral-50)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
};
const errorText: CSSProperties = {
  margin: 0,
  color: 'var(--color-red-700)',
  fontSize: 'var(--fontSize-sm)',
};
const muted: CSSProperties = { margin: 0, color: 'var(--color-neutral-500)' };
