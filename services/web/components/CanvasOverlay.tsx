'use client';

import type { CSSProperties } from 'react';
import type { Box } from '@lighter/preview';

/**
 * The outline drawn over the live app's iframe (#170).
 *
 * Boxes arrive from the SDK in the **frame's** viewport coordinates, so they're rebased onto the
 * studio's viewport by the iframe's own position. Both are viewport-relative, which is why this
 * stays correct as the page scrolls — no scroll offset to track on either side.
 *
 * Purely presentational and `pointer-events: none`: the app underneath must keep behaving exactly as
 * it would without the studio, including its own hover states.
 */
export function CanvasOverlay({
  active,
  frameRect,
  hover,
  selected,
  label,
}: {
  /**
   * Whether the studio is allowed to draw over the app at all — true only in select mode.
   *
   * The rule lives here rather than at the call site because the call site had to remember to gate
   * *every* box, and got it half-right: hover was gated on mode, the selection outline was not, so
   * switching to browse left a rectangle floating over an app the studio was no longer driving.
   * One gate, one place.
   */
  active: boolean;
  frameRect: DOMRect | null;
  hover: Box | null;
  selected: Box | null;
  label: string | null;
}) {
  if (!active || !frameRect) return null;

  const rebase = (box: Box): CSSProperties => ({
    top: frameRect.top + box.top,
    left: frameRect.left + box.left,
    width: box.width,
    height: box.height,
  });

  return (
    <div style={layer} aria-hidden>
      {selected && <div style={{ ...outline, ...selectedOutline, ...rebase(selected) }} />}
      {hover && (
        <>
          <div style={{ ...outline, ...rebase(hover) }} />
          {label && (
            <span
              style={{
                ...tag,
                top: Math.max(frameRect.top, frameRect.top + hover.top - 18),
                left: frameRect.left + hover.left,
              }}
            >
              {label}
            </span>
          )}
        </>
      )}
    </div>
  );
}

const layer: CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 60,
};

const outline: CSSProperties = {
  position: 'fixed',
  border: '2px solid var(--primary-default, #2563eb)',
  borderRadius: 3,
  background: 'color-mix(in srgb, var(--primary-default, #2563eb) 8%, transparent)',
  pointerEvents: 'none',
  transition: 'all 60ms ease-out',
};

/** The current selection reads as settled rather than transient, so it's a solid outline, no tint. */
const selectedOutline: CSSProperties = {
  borderColor: 'var(--primary-hover, #1d4ed8)',
  borderStyle: 'solid',
  background: 'transparent',
  boxShadow: '0 0 0 1px color-mix(in srgb, var(--primary-hover, #1d4ed8) 40%, transparent)',
};

const tag: CSSProperties = {
  position: 'fixed',
  padding: '1px 5px',
  borderRadius: 4,
  background: 'var(--primary-default, #2563eb)',
  color: '#fff',
  fontSize: 10,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
};
