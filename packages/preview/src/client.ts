import {
  PROTOCOL_VERSION,
  TOKEN_STYLE_ID,
  asParentMessage,
  isCompatible,
  type FrameMessage,
} from './protocol.js';

export const SDK_VERSION = '0.1.0';

export interface PreviewHandlers {
  /** A new spec arrived. Return false to reject it (the SDK then reports an error upward). */
  onSpec?: (spec: unknown, meta: { screenId: string; version: number | null }) => boolean | void;
  /** Soft refresh — re-fetch data without losing client state (e.g. Next's `router.refresh()`). */
  onRefresh?: () => void;
  /** Connection state changed, so the app can show a "connected to Lighter" affordance. */
  onConnection?: (connected: boolean) => void;
}

export interface PreviewOptions extends PreviewHandlers {
  /**
   * Lighter origins permitted to drive this app. REQUIRED — an app must name who may control it.
   * Messages from anywhere else are ignored, and we never post with `targetOrigin: '*'`.
   */
  allowedOrigins: string[];
  /** The screen this route renders, announced in the handshake. */
  screenId?: string | null;
}

/**
 * Connect a consumer app to Lighter's live preview (#167).
 *
 * Returns a disconnect function. Safe to call anywhere: when the app is not framed, this is a no-op
 * and returns immediately, so shipping the SDK to production costs nothing.
 *
 * Security posture: the app declares which origins may drive it, we validate `event.origin` on every
 * message, and once a parent answers the handshake we lock to that single origin.
 */
export function connectPreview(options: PreviewOptions): () => void {
  if (typeof window === 'undefined') return () => {};
  // Not in an iframe → not being previewed. Production apps take this path.
  if (window.parent === window) return () => {};

  const allowed = options.allowedOrigins.filter(Boolean);
  if (allowed.length === 0) return () => {};

  let lockedOrigin: string | null = null;

  const post = (message: FrameMessage) => {
    const targets = lockedOrigin ? [lockedOrigin] : allowed;
    for (const origin of targets) {
      try {
        window.parent.postMessage(message, origin);
      } catch {
        // A bad origin string shouldn't take the app down.
      }
    }
  };

  const onMessage = (event: MessageEvent) => {
    if (!allowed.includes(event.origin)) return;
    if (lockedOrigin && event.origin !== lockedOrigin) return;

    const message = asParentMessage(event.data);
    if (!message) return;

    switch (message.type) {
      case 'lighter:ready': {
        if (!isCompatible(message.protocol)) {
          post({
            type: 'lighter:error',
            message: `Protocol mismatch: studio speaks v${message.protocol}, SDK speaks v${PROTOCOL_VERSION}.`,
          });
          return;
        }
        lockedOrigin = event.origin;
        options.onConnection?.(true);
        return;
      }
      case 'lighter:spec': {
        // The app decides whether the spec is usable; a rejected spec leaves the last-good one in
        // place rather than white-screening the page.
        const accepted = options.onSpec?.(message.spec, {
          screenId: message.screenId,
          version: message.version,
        });
        if (accepted === false) {
          post({ type: 'lighter:error', message: 'Spec rejected; keeping the previous one.' });
        }
        return;
      }
      case 'lighter:tokens': {
        applyTokenCss(message.css);
        return;
      }
      case 'lighter:refresh': {
        if (message.hard) window.location.reload();
        else options.onRefresh?.();
        return;
      }
    }
  };

  window.addEventListener('message', onMessage);
  post({
    type: 'lighter:hello',
    protocol: PROTOCOL_VERSION,
    sdkVersion: SDK_VERSION,
    screenId: options.screenId ?? null,
    path: window.location.pathname,
  });

  return () => {
    window.removeEventListener('message', onMessage);
    options.onConnection?.(false);
  };
}

/**
 * Swap the token override sheet.
 *
 * Tokens are CSS custom properties, so this is a textContent write on one `<style>` element — no
 * reload, no React re-render, and every bit of app state survives. It is appended last in `<head>`
 * so it wins over the design system's own sheet without needing `!important`.
 */
export function applyTokenCss(css: string): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(TOKEN_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = TOKEN_STYLE_ID;
    document.head.append(style);
  } else if (style.parentElement !== document.head || style !== document.head.lastElementChild) {
    // Keep it last so later-mounted stylesheets can't outrank the override.
    document.head.append(style);
  }
  style.textContent = css;
}

/** Tell the studio the app navigated, so it can follow which screen is showing. */
export function notifyNavigated(
  screenId: string | null,
  allowedOrigins: string[],
): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  for (const origin of allowedOrigins.filter(Boolean)) {
    try {
      window.parent.postMessage(
        { type: 'lighter:navigated', screenId, path: window.location.pathname },
        origin,
      );
    } catch {
      /* ignore */
    }
  }
}
