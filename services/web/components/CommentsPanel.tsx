'use client';

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import type { SpecElement } from '../lib/specElements.js';
import { postComment, type CommentRecord, type NewComment } from '../lib/comments.js';
import { threadComments } from '../lib/threadComments.js';
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
  bare = false,
  focusElementId = null,
}: {
  token: string;
  elements: SpecElement[];
  initialComments: CommentRecord[];
  /** Set when the initial comment load failed, so the panel says so instead of "no comments yet". */
  loadError?: string | null;
  submit?: SubmitFn;
  /** Drop the sidebar chrome (border/background/width) so an overlay host can supply its own (#160). */
  bare?: boolean;
  /** Element selected on the screen itself; adopted as the composer's anchor (#160). */
  focusElementId?: string | null;
}) {
  const [comments, setComments] = useState(initialComments);
  const [elementId, setElementId] = useState(elements[0]?.id ?? '');
  const [replyTo, setReplyTo] = useState<CommentRecord | null>(null);
  const [body, setBody] = useState('');
  const [author, setAuthor] = useState('');

  // Adopt the element the reviewer picked on the screen. Clearing any in-progress reply keeps the
  // composer honest: a reply inherits its parent's anchor, so it must not silently retarget.
  useEffect(() => {
    if (!focusElementId) return;
    setElementId(focusElementId);
    setReplyTo(null);
  }, [focusElementId]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const typeOf = useMemo(() => new Map(elements.map((e) => [e.id, e.type])), [elements]);
  const threads = useMemo(() => threadComments(comments), [comments]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // A reply needs a target; a top-level comment needs an element anchor.
    if (body.trim().length === 0 || (replyTo === null && elementId.length === 0)) return;
    setPending(true);
    setError(null);
    const input: NewComment = replyTo
      ? { parentId: replyTo.id, body: body.trim(), author: author.trim() || undefined }
      : { elementId, body: body.trim(), author: author.trim() || undefined };
    try {
      const created = await submit(token, input);
      setComments((prev) => [...prev, created]);
      setBody(''); // keep the element + name for the next comment
      setReplyTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your comment.');
    } finally {
      setPending(false);
    }
  }

  return (
    // In bare mode the overlay's <aside> already provides the named landmark, so naming this section
    // too would announce two nested landmarks with the same name.
    <section style={bare ? barePanel : panel} aria-label={bare ? undefined : 'Review comments'}>
      {!bare && <h2 style={heading}>Comments</h2>}

      {loadError ? (
        <p style={muted}>Couldn’t load existing comments. You can still leave a new one below.</p>
      ) : threads.length === 0 ? (
        <p style={muted}>No comments yet. Choose an element below to leave the first.</p>
      ) : (
        <ul role="list" aria-label="Comments" style={list}>
          {threads.map(({ root, replies }) => (
            <li key={root.id} style={item}>
              <p style={itemBody}>{root.body}</p>
              <p style={meta}>
                <span style={anchor}>
                  {root.elementId}
                  {typeOf.get(root.elementId) ? ` · ${typeOf.get(root.elementId)}` : ''}
                </span>
                {' · '}
                {root.author ?? 'Anonymous'}
                {' · '}
                {formatDeployedAt(root.createdAt)}
              </p>
              {replies.length > 0 ? (
                <ul style={replyList}>
                  {replies.map((r) => (
                    <li key={r.id} style={replyItem}>
                      <p style={itemBody}>{r.body}</p>
                      <p style={meta}>
                        {r.author ?? 'Anonymous'}
                        {' · '}
                        {formatDeployedAt(r.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button type="button" style={replyButton} onClick={() => setReplyTo(root)}>
                Reply
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} style={form}>
        {replyTo ? (
          <p style={replyingTo}>
            Replying to {replyTo.author ?? 'Anonymous'}
            <button type="button" style={linkButton} onClick={() => setReplyTo(null)}>
              Cancel
            </button>
          </p>
        ) : (
          <label style={field}>
            Element
            <select
              value={elementId}
              onChange={(e) => setElementId(e.target.value)}
              style={control}
            >
              {elements.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.id} · {el.type}
                </option>
              ))}
            </select>
          </label>
        )}
        <label style={field}>
          Comment
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            style={control}
            placeholder={replyTo ? 'Write a reply…' : 'What should change?'}
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
          {pending ? 'Posting…' : replyTo ? 'Post reply' : 'Post comment'}
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

/** Overlay host supplies the surface, so the panel contributes layout only (#160). */
const barePanel: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  padding: 0,
  background: 'transparent',
  border: 'none',
  minWidth: 0,
  maxWidth: 'none',
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
const replyList: CSSProperties = {
  listStyle: 'none',
  margin: 'var(--space-2) 0 0',
  padding: '0 0 0 var(--space-4)',
  borderLeft: '2px solid var(--color-neutral-300)',
  display: 'grid',
  gap: 'var(--space-2)',
};
const replyItem: CSSProperties = { margin: 0 };
const replyButton: CSSProperties = {
  marginTop: 'var(--space-2)',
  padding: '2px var(--space-2)',
  background: 'transparent',
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-blue-700)',
  fontSize: 'var(--fontSize-xs)',
  cursor: 'pointer',
};
const replyingTo: CSSProperties = {
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontSize: 'var(--fontSize-sm)',
  color: 'var(--color-neutral-700)',
};
const linkButton: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--color-blue-700)',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
  font: 'inherit',
};

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
