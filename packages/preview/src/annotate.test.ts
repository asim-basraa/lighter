// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { effectiveBox, elementAt, ancestorIds, hitFor, measureElement, EL_ATTR } from './annotate.js';

/** happy-dom has no layout engine, so the rects under test are stubbed. */
function withRect(el: Element, r: { top: number; left: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({
      ...r,
      right: r.left + r.width,
      bottom: r.top + r.height,
      x: r.left,
      y: r.top,
      toJSON() {},
    }) as DOMRect;
  return el;
}
const zero = (el: Element) => withRect(el, { top: 0, left: 0, width: 0, height: 0 });

describe('effectiveBox', () => {
  it('uses the element’s own box when it has one', () => {
    const el = withRect(document.createElement('div'), { top: 10, left: 20, width: 100, height: 40 });
    expect(effectiveBox(el)).toEqual({ top: 10, left: 20, width: 100, height: 40 });
  });

  it('unions descendants when the carrier has none (the display:contents case)', () => {
    // The whole reason this helper exists: id carriers generate no box of their own.
    const carrier = zero(document.createElement('span'));
    const a = withRect(document.createElement('div'), { top: 10, left: 10, width: 50, height: 20 });
    const b = withRect(document.createElement('div'), { top: 40, left: 30, width: 50, height: 20 });
    carrier.append(a, b);
    expect(effectiveBox(carrier)).toEqual({ top: 10, left: 10, width: 70, height: 50 });
  });

  it('returns null when nothing is measurable, so callers skip instead of drawing at 0,0', () => {
    expect(effectiveBox(zero(document.createElement('span')))).toBeNull();
  });
});

describe('elementAt / ancestorIds', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function tree() {
    const shell = document.createElement('span');
    shell.setAttribute(EL_ATTR, 'el-0');
    const grid = document.createElement('span');
    grid.setAttribute(EL_ATTR, 'el-1');
    const button = document.createElement('span');
    button.setAttribute(EL_ATTR, 'el-3');
    const label = document.createElement('em');
    button.append(label);
    grid.append(button);
    shell.append(grid);
    document.body.append(shell);
    return { shell, grid, button, label };
  }

  it('finds the innermost annotated ancestor of an event target', () => {
    const { label } = tree();
    expect(elementAt(label)?.getAttribute(EL_ATTR)).toBe('el-3');
  });

  it('returns null outside any annotated element', () => {
    expect(elementAt(document.createElement('div'))).toBeNull();
    expect(elementAt(null)).toBeNull();
  });

  it('walks outermost → innermost so a breadcrumb reads top-down', () => {
    const { button } = tree();
    expect(ancestorIds(button)).toEqual(['el-0', 'el-1', 'el-3']);
  });

  it('reports ids only — the SDK knows nothing about component types', () => {
    // Types are resolved parent-side from the spec, so the SDK never needs updating when the spec
    // model changes.
    const { button } = tree();
    expect(ancestorIds(button).every((id) => /^el-\d+$/.test(id))).toBe(true);
  });
});

describe('hitFor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reports id, box and ancestors for an annotated target', () => {
    const card = document.createElement('span');
    card.setAttribute(EL_ATTR, 'el-2');
    zero(card);
    const button = document.createElement('span');
    button.setAttribute(EL_ATTR, 'el-3');
    zero(button);
    const inner = withRect(document.createElement('b'), { top: 5, left: 6, width: 90, height: 30 });
    button.append(inner);
    card.append(button);
    document.body.append(card);

    expect(hitFor(inner)).toEqual({
      id: 'el-3',
      box: { top: 5, left: 6, width: 90, height: 30 },
      ancestors: ['el-2', 'el-3'],
    });
  });

  it('returns null when the target is not inside an annotated element', () => {
    expect(hitFor(document.createElement('div'))).toBeNull();
    expect(hitFor(null)).toBeNull();
  });

  it('returns null when the element has no measurable box, rather than a zero rect', () => {
    const el = zero(document.createElement('span'));
    el.setAttribute(EL_ATTR, 'el-9');
    document.body.append(el);
    expect(hitFor(el)).toBeNull();
  });
});

describe('measureElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds an element by its spec id', () => {
    const el = withRect(document.createElement('div'), { top: 1, left: 2, width: 3, height: 4 });
    el.setAttribute(EL_ATTR, 'el-7');
    document.body.append(el);
    expect(measureElement('el-7')).toEqual({ top: 1, left: 2, width: 3, height: 4 });
  });

  it('returns null for an id that is not on the page', () => {
    expect(measureElement('el-404')).toBeNull();
  });
});
