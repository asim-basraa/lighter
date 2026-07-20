// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { effectiveBox, elementAt, ancestorChain, toLocal, EL_ATTR } from './annotation.js';

/** happy-dom has no layout engine, so stub the rects we're reasoning about. */
function withRect(el: Element, r: { top: number; left: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
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
  it('uses the elemential box when it has one', () => {
    const el = withRect(document.createElement('div'), { top: 10, left: 20, width: 100, height: 40 });
    expect(effectiveBox(el)).toEqual({ top: 10, left: 20, width: 100, height: 40 });
  });

  it('unions descendants when the carrier has no box (the display:contents case)', () => {
    // This is the whole reason the helper exists: the id carrier generates no box.
    const carrier = zero(document.createElement('span'));
    const a = withRect(document.createElement('div'), { top: 10, left: 10, width: 50, height: 20 });
    const b = withRect(document.createElement('div'), { top: 40, left: 30, width: 50, height: 20 });
    carrier.append(a, b);
    expect(effectiveBox(carrier)).toEqual({ top: 10, left: 10, width: 70, height: 50 });
  });

  it('recurses through nested carriers', () => {
    const outer = zero(document.createElement('span'));
    const inner = zero(document.createElement('span'));
    const leaf = withRect(document.createElement('div'), { top: 5, left: 5, width: 10, height: 10 });
    inner.append(leaf);
    outer.append(inner);
    expect(effectiveBox(outer)).toEqual({ top: 5, left: 5, width: 10, height: 10 });
  });

  it('returns null when nothing is measurable, so callers skip instead of drawing at 0,0', () => {
    expect(effectiveBox(zero(document.createElement('span')))).toBeNull();
  });
});

describe('elementAt', () => {
  it('finds the innermost annotated ancestor of the event target', () => {
    const card = document.createElement('span');
    card.setAttribute(EL_ATTR, 'el-2');
    const button = document.createElement('span');
    button.setAttribute(EL_ATTR, 'el-3');
    const label = document.createElement('em');
    button.append(label);
    card.append(button);
    document.body.append(card);
    expect(elementAt(label)?.getAttribute(EL_ATTR)).toBe('el-3');
    card.remove();
  });

  it('returns null outside any annotated element', () => {
    expect(elementAt(document.createElement('div'))).toBeNull();
    expect(elementAt(null)).toBeNull();
  });
});

describe('ancestorChain', () => {
  it('walks outermost → innermost so the breadcrumb reads top-down', () => {
    const shell = document.createElement('span');
    shell.setAttribute(EL_ATTR, 'el-0');
    const grid = document.createElement('span');
    grid.setAttribute(EL_ATTR, 'el-1');
    const button = document.createElement('span');
    button.setAttribute(EL_ATTR, 'el-3');
    grid.append(button);
    shell.append(grid);
    document.body.append(shell);

    const types: Record<string, string> = { 'el-0': 'PageShell', 'el-1': 'Grid', 'el-3': 'Button' };
    expect(ancestorChain(button, (id) => types[id]).map((a) => `${a.id}:${a.type}`)).toEqual([
      'el-0:PageShell',
      'el-1:Grid',
      'el-3:Button',
    ]);
    shell.remove();
  });
});

describe('toLocal', () => {
  it('rebases a viewport box onto the positioned container', () => {
    const container = { top: 100, left: 50 } as DOMRect;
    expect(toLocal({ top: 130, left: 70, width: 10, height: 5 }, container)).toEqual({
      top: 30,
      left: 20,
      width: 10,
      height: 5,
    });
  });
});
