'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { CommentsPanel } from './CommentsPanel.js';
import type { SpecElement } from '../lib/specElements.js';
import type { CommentRecord } from '../lib/comments.js';

/**
 * Review comments as an overlay rather than a column (#160).
 *
 * The old split layout gave the comments a permanent third of the viewport, so reviewers judged the
 * screen at a width no user will ever see — and below ~800px the mock squeezed and controls clipped.
 * Here the screen gets the full viewport and the comments float above it: a button that opens a
 * translucent, blurred panel, so the screen stays visible behind what you're writing about.
 *
 * The panel hosts the existing `CommentsPanel` (threading, anchoring, validation, optimistic append)
 * unchanged — this is presentation only. Element pins and hover selection land next; until then the
 * element picker inside the panel is how a comment gets anchored, so nothing is blocked.
 */
export function CommentsOverlay({
  token,
  elements,
  initialComments,
  loadError = null,
  focusElementId = null,
  openSignal = 0,
}: {
  token: string;
  elements: SpecElement[];
  initialComments: CommentRecord[];
  loadError?: string | null;
  /** Element chosen on the screen itself (pin, click, or breadcrumb) — preselected in the composer. */
  focusElementId?: string | null;
  /** Bumped on each selection so re-picking the same element still opens the panel (#160). */
  openSignal?: number;
}) {
  const [open, setOpen] = useState(false);

  // Selecting an element on the screen opens the panel — pointing and writing are one act.
  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);
  const count = initialComments.length;

  return (
    <>
      {open && (
        <aside style={panel} aria-label="Review comments">
          <header style={header}>
            <strong>Comments</strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={close}
              aria-label="Close comments"
            >
              ×
            </button>
          </header>
          <div style={body}>
            <CommentsPanel
              bare
              token={token}
              elements={elements}
              initialComments={initialComments}
              loadError={loadError}
              focusElementId={focusElementId}
            />
          </div>
        </aside>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={fab}
        aria-expanded={open}
        aria-label={`${open ? 'Hide' : 'Show'} comments${count ? `, ${count}` : ''}`}
      >
        Comments{count > 0 && <span style={badge}>{count}</span>}
      </button>
    </>
  );
}

/** Translucent + blurred: legible to write in, but the screen behind stays readable. */
const panel: CSSProperties = {
  position: 'fixed',
  right: '1rem',
  bottom: '4.25rem',
  zIndex: 50,
  width: 'min(380px, calc(100vw - 2rem))',
  maxHeight: 'min(70vh, 640px)',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  padding: 'var(--space-4)',
  borderRadius: 12,
  border: '1px solid var(--border-default, #e2e8f0)',
  background: 'color-mix(in srgb, var(--background-canvas, #fff) 88%, transparent)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 12px 32px rgb(15 23 42 / 0.18)',
};

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 'var(--fontSize-lg)',
  color: 'var(--foreground-default, #0f172a)',
};

const close: CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: '1.4rem',
  lineHeight: 1,
  cursor: 'pointer',
  color: 'var(--foreground-muted, #64748b)',
};

const body: CSSProperties = { minWidth: 0 };

const fab: CSSProperties = {
  position: 'fixed',
  right: '1rem',
  bottom: '1rem',
  zIndex: 51,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.6rem 1rem',
  borderRadius: 999,
  border: 'none',
  background: 'var(--primary-default, #2563eb)',
  color: 'var(--primary-foreground, #fff)',
  fontSize: 'var(--fontSize-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 6px 18px rgb(37 99 235 / 0.35)',
};

const badge: CSSProperties = {
  background: 'color-mix(in srgb, #fff 28%, transparent)',
  borderRadius: 999,
  padding: '0 0.4rem',
  fontSize: 'var(--fontSize-xs)',
};
