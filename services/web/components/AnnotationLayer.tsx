'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  EL_ATTR,
  effectiveBox,
  elementAt,
  ancestorChain,
  toLocal,
  type Box,
  type Ancestor,
} from '../lib/annotation.js';

/**
 * The annotation layer over a rendered screen (#160).
 *
 * Reviewers point at what they mean: hovering outlines the element under the cursor, an ancestor
 * breadcrumb lets them climb from a Button to its Card to the whole Grid (so a comment can anchor to a
 * *block*, not just a leaf), and elements that already have comments carry a numbered pin.
 *
 * Two modes, because the screen has its own affordances (flow links today, json-render actions after
 * #155): in **browse** the prototype behaves normally and only pins are interactive; in **comment**
 * the layer hit-tests every element. Pins stay live in both, so existing threads are always reachable.
 *
 * The layer never intercepts pointer events wholesale — it hit-tests from listeners on the host and
 * keeps itself `pointer-events: none` except for its own controls, so it can't alter how the screen
 * behaves or looks.
 */
export interface Pin {
  elementId: string;
  count: number;
}

export function AnnotationLayer({
  hostRef,
  mode,
  pins,
  typeOf,
  selectedId,
  onSelect,
}: {
  hostRef: React.RefObject<HTMLElement>;
  mode: 'browse' | 'comment';
  pins: Pin[];
  typeOf: (id: string) => string | undefined;
  selectedId: string | null;
  onSelect: (elementId: string) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  /** When set, the breadcrumb is steering the outline instead of the cursor. */
  const [chain, setChain] = useState<Ancestor[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [tick, setTick] = useState(0);

  const highlightId = targetId ?? hoverId ?? selectedId;

  /** Measure every annotated element, rebased onto the layer. Re-runs on resize/scroll/content change. */
  const measure = useCallback(() => {
    const host = hostRef.current;
    const layer = layerRef.current;
    if (!host || !layer) return;
    const origin = layer.getBoundingClientRect();
    const next: Record<string, Box> = {};
    for (const node of Array.from(host.querySelectorAll<HTMLElement>(`[${EL_ATTR}]`))) {
      const id = node.getAttribute(EL_ATTR);
      if (!id) continue;
      const box = effectiveBox(node);
      // Unmeasurable elements are skipped rather than drawn at the origin; they stay commentable
      // through the element picker, so review is never blocked.
      if (box) next[id] = toLocal(box, origin);
    }
    setBoxes(next);
  }, [hostRef]);

  useLayoutEffect(() => {
    measure();
  }, [measure, tick]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Layout settles late (fonts, images, async content), so observe rather than measure once.
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    ro.observe(host);
    for (const node of Array.from(host.querySelectorAll<HTMLElement>(`[${EL_ATTR}]`))) ro.observe(node);
    const onScroll = () => setTick((t) => t + 1);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [hostRef]);

  // Hit-test from the host so the layer never has to swallow pointer events.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || mode !== 'comment') {
      setHoverId(null);
      setChain([]);
      setTargetId(null);
      return;
    }
    const onMove = (e: PointerEvent) => {
      const node = elementAt(e.target);
      const id = node?.getAttribute(EL_ATTR) ?? null;
      setHoverId(id);
      setTargetId(null);
      setChain(node ? ancestorChain(node, typeOf) : []);
    };
    const onLeave = () => {
      setHoverId(null);
      setChain([]);
      setTargetId(null);
    };
    const onClick = (e: MouseEvent) => {
      const node = elementAt(e.target);
      const id = targetId ?? node?.getAttribute(EL_ATTR);
      if (!id) return;
      // In comment mode a click annotates rather than driving the prototype.
      e.preventDefault();
      e.stopPropagation();
      onSelect(id);
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('click', onClick, true);
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('click', onClick, true);
    };
  }, [hostRef, mode, typeOf, onSelect, targetId]);

  // Keyboard: climb to the parent / back down, mirroring the breadcrumb.
  useEffect(() => {
    if (mode !== 'comment' || chain.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const idx = chain.findIndex((a) => a.id === (targetId ?? hoverId));
      if (e.key === 'ArrowUp' && idx > 0) {
        e.preventDefault();
        setTargetId(chain[idx - 1]!.id);
      } else if (e.key === 'ArrowDown' && idx >= 0 && idx < chain.length - 1) {
        e.preventDefault();
        setTargetId(chain[idx + 1]!.id);
      } else if (e.key === 'Escape') {
        setTargetId(null);
        setHoverId(null);
        setChain([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, chain, targetId, hoverId]);

  const highlight = highlightId ? boxes[highlightId] : undefined;

  return (
    <div ref={layerRef} style={layer} data-annotation-layer>
      {highlight && (
        <div
          style={{
            ...outline,
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            borderColor: highlightId === selectedId ? 'var(--primary-hover, #1d4ed8)' : 'var(--primary-default, #2563eb)',
          }}
          aria-hidden
        />
      )}

      {/* Breadcrumb: the deliberate way to widen a selection from a leaf to the block containing it. */}
      {mode === 'comment' && chain.length > 0 && highlight && (
        <div
          style={{ ...breadcrumb, top: Math.max(0, highlight.top - 26), left: highlight.left }}
          onPointerLeave={() => setTargetId(null)}
        >
          {chain.map((a, i) => (
            <span key={a.id}>
              {i > 0 && <span style={sep}>›</span>}
              <button
                type="button"
                style={a.id === highlightId ? crumbActive : crumb}
                onPointerEnter={() => setTargetId(a.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(a.id);
                }}
              >
                {a.type}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Pins stay interactive in both modes so existing threads are always reachable. */}
      {pins.map((pin, i) => {
        const box = boxes[pin.elementId];
        if (!box) return null;
        return (
          <button
            key={pin.elementId}
            type="button"
            style={{ ...pinStyle, top: box.top - 10, left: box.left + box.width - 10 }}
            onClick={() => onSelect(pin.elementId)}
            onPointerEnter={() => setHoverId(pin.elementId)}
            onPointerLeave={() => setHoverId(null)}
            title={`${pin.count} comment${pin.count === 1 ? '' : 's'}`}
            aria-label={`${pin.count} comment${pin.count === 1 ? '' : 's'} on ${typeOf(pin.elementId) ?? pin.elementId}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

const layer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 40,
};

/** Outline + faint tint: legible over a large block without obscuring what's inside it. */
const outline: CSSProperties = {
  position: 'absolute',
  border: '2px solid var(--primary-default, #2563eb)',
  borderRadius: 4,
  background: 'color-mix(in srgb, var(--primary-default, #2563eb) 8%, transparent)',
  pointerEvents: 'none',
  transition: 'all 60ms ease-out',
};

const breadcrumb: CSSProperties = {
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '2px 6px',
  borderRadius: 6,
  background: 'var(--primary-default, #2563eb)',
  color: '#fff',
  fontSize: 11,
  whiteSpace: 'nowrap',
  pointerEvents: 'auto',
  boxShadow: '0 2px 8px rgb(15 23 42 / 0.25)',
};

const crumb: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'color-mix(in srgb, #fff 75%, transparent)',
  font: 'inherit',
  cursor: 'pointer',
  padding: '0 2px',
};

const crumbActive: CSSProperties = { ...crumb, color: '#fff', fontWeight: 700 };

const sep: CSSProperties = { opacity: 0.6, margin: '0 1px' };

const pinStyle: CSSProperties = {
  position: 'absolute',
  width: 20,
  height: 20,
  borderRadius: '50% 50% 50% 2px',
  border: '2px solid #fff',
  background: 'var(--primary-default, #2563eb)',
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
  cursor: 'pointer',
  pointerEvents: 'auto',
  boxShadow: '0 2px 6px rgb(15 23 42 / 0.3)',
  zIndex: 41,
};
