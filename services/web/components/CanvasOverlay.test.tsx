// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CanvasOverlay } from './CanvasOverlay.js';

afterEach(cleanup);

const rect = (over: Partial<DOMRect> = {}) =>
  ({ top: 0, left: 300, width: 1000, height: 800, ...over }) as DOMRect;

const box = { top: 10, left: 20, width: 100, height: 40 };

/** Any absolutely-positioned outline the overlay drew. */
function drawnBoxes(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('div')].filter((el) =>
    (el.getAttribute('style') ?? '').includes('border'),
  );
}

describe('CanvasOverlay (#170)', () => {
  it('draws hover and selection outlines when active', () => {
    const { container } = render(
      <CanvasOverlay active frameRect={rect()} hover={box} selected={box} label="Button" />,
    );
    expect(drawnBoxes(container).length).toBe(2);
  });

  it('draws NOTHING when inactive, even with boxes still in state', () => {
    // Switching to browse must clear the overlay. The boxes deliberately stay in state so the
    // selection survives a round-trip to browse and back — but nothing may be drawn over an app the
    // studio is no longer driving. This regressed once: hover was gated on mode, the selection
    // outline wasn't, leaving a rectangle floating over the live app.
    const { container } = render(
      <CanvasOverlay active={false} frameRect={rect()} hover={box} selected={box} label="Button" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('draws nothing before the frame has been measured', () => {
    const { container } = render(
      <CanvasOverlay active frameRect={null} hover={box} selected={box} label="Button" />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('rebases boxes by the iframe position, since they arrive in FRAME coordinates', () => {
    const { container } = render(
      <CanvasOverlay
        active
        frameRect={rect({ top: 50, left: 300 })}
        hover={box}
        selected={null}
        label={null}
      />,
    );
    const style = drawnBoxes(container)[0]!.getAttribute('style') ?? '';
    // frame.top 50 + box.top 10, frame.left 300 + box.left 20
    expect(style).toContain('top: 60px');
    expect(style).toContain('left: 320px');
  });

  it('shows the component name beside the hovered element', () => {
    const { getByText } = render(
      <CanvasOverlay active frameRect={rect()} hover={box} selected={null} label="Button" />,
    );
    expect(getByText('Button')).toBeTruthy();
  });

  it('omits the label when there is no hover to attach it to', () => {
    const { queryByText } = render(
      <CanvasOverlay active frameRect={rect()} hover={null} selected={box} label="Button" />,
    );
    expect(queryByText('Button')).toBeNull();
  });
});
