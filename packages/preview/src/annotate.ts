/**
 * Hit-testing inside the previewed app (#170).
 *
 * This has to live in the SDK, not the studio. The studio cannot reach into a cross-origin DOM, and
 * a preview app is a different origin by default (`:4200` vs `:4000` already is). Same-origin
 * sniffing is not a workaround — it breaks the moment the app runs on a real preview domain.
 *
 * So the app answers "what is under the cursor" and forwards the answer; the studio owns the overlay
 * UI. The SDK deliberately knows nothing about specs: it reports element **ids** and boxes, and the
 * studio resolves those to component types from the spec it already holds.
 *
 * Ported from the studio's same-document implementation, which relied on being in the same document.
 */

/** The attribute the design system stamps on each element (mirrors ELEMENT_ID_ATTR). */
export const EL_ATTR = 'data-lighter-el';

// One definition, shared with the wire protocol — a second `Box` would be free to drift from what
// actually crosses the frame boundary.
import type { Box } from './protocol.js';
export type { Box };

const EMPTY = (r: { width: number; height: number }) => r.width === 0 && r.height === 0;

/**
 * The on-screen box of an annotated element, in the FRAME's viewport coordinates.
 *
 * The id carriers use `display: contents`, so they generate no box of their own and
 * `getBoundingClientRect` returns zeros. Falls back to the union of rendered descendants, and
 * returns null when nothing is measurable so callers skip rather than drawing at 0,0.
 */
export function effectiveBox(el: Element): Box | null {
  const own = el.getBoundingClientRect();
  if (!EMPTY(own)) return { top: own.top, left: own.left, width: own.width, height: own.height };

  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let found = false;
  for (const child of Array.from(el.children)) {
    const box = effectiveBox(child);
    if (!box) continue;
    found = true;
    top = Math.min(top, box.top);
    left = Math.min(left, box.left);
    right = Math.max(right, box.left + box.width);
    bottom = Math.max(bottom, box.top + box.height);
  }
  return found ? { top, left, width: right - left, height: bottom - top } : null;
}

/** The annotated element under a point — what the reviewer is actually pointing at. */
export function elementAt(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(`[${EL_ATTR}]`);
}

/**
 * Element ids from the root down to this node, outermost first — the trail the studio turns into a
 * breadcrumb so a comment or selection can widen from a leaf to the block containing it.
 */
export function ancestorIds(node: HTMLElement): string[] {
  const chain: string[] = [];
  let current: HTMLElement | null = node;
  while (current) {
    const id = current.getAttribute(EL_ATTR);
    if (id) chain.push(id);
    current = current.parentElement?.closest<HTMLElement>(`[${EL_ATTR}]`) ?? null;
  }
  return chain.reverse();
}

export interface ElementHit {
  id: string;
  box: Box;
  ancestors: string[];
}

/** Resolve an event target to a reportable hit, or null when it isn't over an annotated element. */
export function hitFor(target: EventTarget | null): ElementHit | null {
  const node = elementAt(target);
  if (!node) return null;
  const id = node.getAttribute(EL_ATTR);
  if (!id) return null;
  const box = effectiveBox(node);
  if (!box) return null;
  return { id, box, ancestors: ancestorIds(node) };
}

/** Look up an element by its spec id — used to re-measure a selection after layout changes. */
export function measureElement(id: string): Box | null {
  if (typeof document === 'undefined') return null;
  const node = document.querySelector<HTMLElement>(`[${EL_ATTR}="${CSS.escape(id)}"]`);
  return node ? effectiveBox(node) : null;
}

export interface AnnotationCallbacks {
  onHover: (hit: ElementHit | null) => void;
  onSelect: (hit: ElementHit) => void;
  /** Layout moved (scroll/resize), so the studio should re-measure what it's outlining. */
  onLayoutChange: () => void;
}

/**
 * Start reporting what's under the cursor. Returns a stop function.
 *
 * Click is captured and suppressed while annotating: in select mode a click means "pick this
 * element", not "follow this link". Browse mode simply doesn't call this, leaving the prototype
 * fully interactive.
 */
export function startAnnotating(callbacks: AnnotationCallbacks): () => void {
  if (typeof document === 'undefined') return () => {};

  const onMove = (event: PointerEvent) => callbacks.onHover(hitFor(event.target));
  const onLeave = () => callbacks.onHover(null);
  const onClick = (event: MouseEvent) => {
    const hit = hitFor(event.target);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    callbacks.onSelect(hit);
  };
  const onLayout = () => callbacks.onLayoutChange();

  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerleave', onLeave, true);
  document.addEventListener('click', onClick, true);
  window.addEventListener('scroll', onLayout, true);
  window.addEventListener('resize', onLayout);

  return () => {
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerleave', onLeave, true);
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('scroll', onLayout, true);
    window.removeEventListener('resize', onLayout);
    callbacks.onHover(null);
  };
}
