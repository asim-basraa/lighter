'use client';

import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import { SharedMock } from './SharedMock.js';
import { AnnotationLayer, type Pin } from './AnnotationLayer.js';
import { CommentsOverlay } from './CommentsOverlay.js';
import type { SharedVersion } from '../lib/share.js';
import type { SpecElement } from '../lib/specElements.js';
import type { CommentRecord } from '../lib/comments.js';

/**
 * The reviewer's workspace (#160): the screen at full width, with commenting layered over it.
 *
 * Owns the two pieces of state the layer and the panel must agree on — the current mode, and which
 * element is selected — so pointing at something on the screen and writing about it are the same act.
 * Selecting an element (by clicking it in comment mode, clicking its pin, or picking a breadcrumb
 * crumb) opens the panel with that element already chosen.
 */
export function ReviewSurface({
  share,
  token,
  elements,
  initialComments,
  loadError = null,
}: {
  share: SharedVersion;
  token: string;
  elements: SpecElement[];
  initialComments: CommentRecord[];
  loadError?: string | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'browse' | 'comment'>('browse');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openSignal, setOpenSignal] = useState(0);

  const typeOf = useCallback(
    (id: string) => elements.find((e) => e.id === id)?.type,
    [elements],
  );

  /** One pin per element that has comments, numbered in spec order so it reads consistently. */
  const pins: Pin[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of initialComments) counts.set(c.elementId, (counts.get(c.elementId) ?? 0) + 1);
    return elements
      .filter((e) => counts.has(e.id))
      .map((e) => ({ elementId: e.id, count: counts.get(e.id)! }));
  }, [elements, initialComments]);

  const select = useCallback((elementId: string) => {
    setSelectedId(elementId);
    // Bump a signal rather than a boolean so re-selecting the same element re-opens the panel.
    setOpenSignal((n) => n + 1);
  }, []);

  return (
    <div style={wrap}>
      <div ref={hostRef} style={host}>
        <SharedMock share={share} annotate />
      </div>

      <AnnotationLayer
        hostRef={hostRef}
        mode={mode}
        pins={pins}
        typeOf={typeOf}
        selectedId={selectedId}
        onSelect={select}
      />

      <div style={modeBar} role="group" aria-label="Review mode">
        <button
          type="button"
          onClick={() => setMode('browse')}
          style={mode === 'browse' ? modeOn : modeOff}
          aria-pressed={mode === 'browse'}
        >
          Browse
        </button>
        <button
          type="button"
          onClick={() => setMode('comment')}
          style={mode === 'comment' ? modeOn : modeOff}
          aria-pressed={mode === 'comment'}
        >
          Comment
        </button>
      </div>

      {mode === 'comment' && (
        <p style={hint} role="status">
          Hover to highlight · click to comment · use the breadcrumb to select a block
        </p>
      )}

      <CommentsOverlay
        token={token}
        elements={elements}
        initialComments={initialComments}
        loadError={loadError}
        focusElementId={selectedId}
        openSignal={openSignal}
      />
    </div>
  );
}

const wrap: CSSProperties = { position: 'relative', minHeight: '100vh' };
const host: CSSProperties = { minHeight: '100vh' };

const modeBar: CSSProperties = {
  position: 'fixed',
  left: '1rem',
  bottom: '1rem',
  zIndex: 51,
  display: 'inline-flex',
  borderRadius: 999,
  overflow: 'hidden',
  border: '1px solid var(--border-default, #e2e8f0)',
  background: 'color-mix(in srgb, var(--background-canvas, #fff) 90%, transparent)',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 14px rgb(15 23 42 / 0.12)',
};

const modeOff: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: '0.5rem 0.9rem',
  cursor: 'pointer',
  fontSize: 'var(--fontSize-sm)',
  color: 'var(--foreground-muted, #64748b)',
};

const modeOn: CSSProperties = {
  ...modeOff,
  background: 'var(--primary-default, #2563eb)',
  color: '#fff',
  fontWeight: 600,
};

const hint: CSSProperties = {
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)',
  bottom: '1rem',
  zIndex: 51,
  margin: 0,
  padding: '0.4rem 0.8rem',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--foreground-default, #0f172a) 82%, transparent)',
  color: '#fff',
  fontSize: 'var(--fontSize-xs)',
  pointerEvents: 'none',
};
