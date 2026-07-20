// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { AnnotationLayer } from './AnnotationLayer.js';
import { EL_ATTR } from '../lib/annotation.js';

afterEach(cleanup);

/**
 * happy-dom has no layout engine, so every box is stubbed. These tests cover the *wiring* — which
 * element the layer decides you're pointing at, and how the breadcrumb widens that decision — which
 * is the part that regressed easily during #160. Real geometry is verified in annotation.test.ts.
 */
function stub(el: Element, r: { top: number; left: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({ ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON() {} }) as DOMRect;
  return el;
}

/** A Card containing a Button, mirroring the `display: contents` carriers the design system emits. */
function buildHost() {
  const host = document.createElement('div');
  stub(host, { top: 0, left: 0, width: 1000, height: 500 });

  const card = document.createElement('span');
  card.setAttribute(EL_ATTR, 'el-4');
  stub(card, { top: 100, left: 50, width: 400, height: 150 });

  const button = document.createElement('span');
  button.setAttribute(EL_ATTR, 'el-8');
  stub(button, { top: 200, left: 60, width: 100, height: 32 });

  const label = document.createElement('em');
  stub(label, { top: 200, left: 60, width: 100, height: 32 });

  button.append(label);
  card.append(button);
  host.append(card);
  document.body.append(host);
  return { host, card, button, label };
}

const types: Record<string, string> = { 'el-4': 'Card', 'el-8': 'Button' };
const typeOf = (id: string) => types[id];

function setup(mode: 'browse' | 'comment', onSelect: (id: string) => void = () => {}) {
  const { host, label } = buildHost();
  const ref = createRef<HTMLElement>();
  (ref as { current: HTMLElement | null }).current = host;
  render(
    <AnnotationLayer
      hostRef={ref as React.RefObject<HTMLElement>}
      mode={mode}
      pins={[]}
      typeOf={typeOf}
      selectedId={null}
      onSelect={onSelect}
    />,
  );
  return { host, label };
}

describe('AnnotationLayer (#160)', () => {
  it('builds the ancestor breadcrumb from the innermost element under the cursor', () => {
    const { label } = setup('comment');
    fireEvent.pointerMove(label);
    // Pointing at the button's inner text still reads as the Button, inside its Card.
    expect(screen.getByRole('button', { name: 'Card' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Button' })).toBeTruthy();
  });

  it('stays inert in browse mode so the prototype behaves normally', () => {
    const { label } = setup('browse');
    fireEvent.pointerMove(label);
    expect(screen.queryByRole('button', { name: 'Card' })).toBeNull();
  });

  it('selects the ancestor when its crumb is clicked, so a comment can anchor to a block', () => {
    const picked: string[] = [];
    const { label } = setup('comment', (id) => picked.push(id));
    fireEvent.pointerMove(label);
    fireEvent.click(screen.getByRole('button', { name: 'Card' }));
    expect(picked).toEqual(['el-4']);
  });

  it('clears the highlight on pointer leave', () => {
    const { host, label } = setup('comment');
    fireEvent.pointerMove(label);
    expect(screen.queryByRole('button', { name: 'Card' })).toBeTruthy();
    // pointerleave doesn't bubble, so it fires on the host — where the real listener lives.
    fireEvent.pointerLeave(host);
    expect(screen.queryByRole('button', { name: 'Card' })).toBeNull();
  });
});
