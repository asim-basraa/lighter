/**
 * Geometry + hit-testing for the annotated review surface (#160).
 *
 * Elements are tagged with `data-lighter-el` by the design system's opt-in annotate mode. Those
 * carriers use `display: contents`, so they generate **no box of their own** — `getBoundingClientRect`
 * returns zeros. Outlines and pins therefore measure the union of the carrier's rendered descendants.
 */

/** The attribute the design system stamps each element with (mirrors ELEMENT_ID_ATTR). */
export const EL_ATTR = 'data-lighter-el';

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const EMPTY = (r: DOMRect) => r.width === 0 && r.height === 0;

/**
 * The on-screen box of an annotated element. Falls back to the union of descendant boxes when the
 * node itself has none (the `display: contents` case), and returns null when nothing is measurable —
 * e.g. an element that renders no visible box at all. Callers skip those rather than drawing at 0,0.
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

/** The annotated element under a point, innermost first — what the reviewer is actually pointing at. */
export function elementAt(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(`[${EL_ATTR}]`);
}

export interface Ancestor {
  id: string;
  type: string;
  node: HTMLElement;
}

/**
 * The chain from an element up to the root, outermost first — the breadcrumb a reviewer walks to
 * comment on a *block* (the Card, the Grid) rather than the leaf they happened to hover.
 * `typeOf` resolves an id to its component name so the trail reads `PageShell › Grid › Card › Button`.
 */
export function ancestorChain(
  node: HTMLElement,
  typeOf: (id: string) => string | undefined,
): Ancestor[] {
  const chain: Ancestor[] = [];
  let current: HTMLElement | null = node;
  while (current) {
    const id = current.getAttribute(EL_ATTR);
    if (id) chain.push({ id, type: typeOf(id) ?? 'Element', node: current });
    current = current.parentElement?.closest<HTMLElement>(`[${EL_ATTR}]`) ?? null;
  }
  return chain.reverse();
}

/** Convert a viewport box to coordinates relative to a positioned container. */
export function toLocal(box: Box, container: DOMRect): Box {
  return {
    top: box.top - container.top,
    left: box.left - container.left,
    width: box.width,
    height: box.height,
  };
}
