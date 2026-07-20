/**
 * The live-preview wire protocol (#166/#167).
 *
 * Lighter (parent) drives a consumer app running in an iframe. The app renders Lighter specs for
 * real — real routing, real APIs, real state — and Lighter pushes spec and token edits into it.
 *
 * Two properties this protocol must hold:
 *
 * 1. **The app declares; Lighter never guesses.** Every mapping from rendered pixels back to a spec
 *    element comes from the app announcing it, not from Lighter inspecting a DOM it doesn't own.
 * 2. **Both sides degrade explicitly.** The studio and the SDK ship separately, so a version skew is
 *    normal, not exceptional. Unknown message types are ignored rather than thrown, and the
 *    handshake carries a protocol version so each side can say "I can't drive this" out loud
 *    instead of appearing to work.
 */

/** Bumped only on a breaking change to the message shapes below. */
export const PROTOCOL_VERSION = 1;

/** The id of the single <style> element the SDK owns for token overrides. */
export const TOKEN_STYLE_ID = 'lighter-preview-tokens';

/* ── frame → parent ─────────────────────────────────────────────────────────────────────────── */

/** "I am a Lighter-aware app." Sent on connect, and again if the parent asks. */
export interface HelloMessage {
  type: 'lighter:hello';
  protocol: number;
  sdkVersion: string;
  screenId: string | null;
  path: string;
}

/** The app navigated; the studio follows so it knows which screen is on screen. */
export interface NavigatedMessage {
  type: 'lighter:navigated';
  screenId: string | null;
  path: string;
}

/** A pushed spec could not be applied. The app keeps its last-good spec and says so. */
export interface ErrorMessage {
  type: 'lighter:error';
  message: string;
}

/**
 * What's under the cursor, in the FRAME's viewport coordinates (#170).
 *
 * The SDK reports element **ids**, never component types: it knows nothing about specs, and the
 * studio already holds the spec that maps an id to a type. Keeping that boundary means the SDK
 * doesn't need updating when the spec model changes.
 */
export interface ElementMessage {
  type: 'lighter:element';
  /**
   * 'hover' tracks the cursor; 'select' is a deliberate click; 'measure' is the answer to a
   * `lighter:measure` request.
   *
   * 'measure' MUST stay distinct from 'select'. Reusing 'select' makes the studio re-apply the tree
   * selection on every re-measure, which re-triggers the measure — an unbounded postMessage loop
   * (observed at ~37k messages before this was split out).
   */
  kind: 'hover' | 'select' | 'measure';
  /** Null only for kind 'hover', meaning the cursor left every annotated element. */
  element: { id: string; box: Box; ancestors: string[] } | null;
}

/** The frame's layout moved (scroll/resize), so the studio should re-measure. */
export interface LayoutMessage {
  type: 'lighter:layout';
}

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type FrameMessage =
  | HelloMessage
  | NavigatedMessage
  | ErrorMessage
  | ElementMessage
  | LayoutMessage;

/* ── parent → frame ─────────────────────────────────────────────────────────────────────────── */

/** Acknowledges a hello. Receiving this is what locks the SDK to a single parent origin. */
export interface ReadyMessage {
  type: 'lighter:ready';
  protocol: number;
}

/** Swap the rendered spec. No reload — the app keeps its cart, scroll position and form state. */
export interface SpecMessage {
  type: 'lighter:spec';
  screenId: string;
  version: number | null;
  spec: unknown;
}

/** Swap the token override sheet. CSS custom properties, so this costs about one frame. */
export interface TokensMessage {
  type: 'lighter:tokens';
  css: string;
}

/** Re-fetch. `hard` reloads the document; otherwise the app refreshes its own data in place. */
export interface RefreshMessage {
  type: 'lighter:refresh';
  hard?: boolean;
}

/**
 * Turn hit-testing on or off in the app (#170).
 *
 * Off by default so the prototype behaves normally — clicking a link follows it. While on, the SDK
 * captures clicks and reports them instead, because in select mode a click means "pick this
 * element".
 */
/**
 * "Are you there?" — the parent asking the app to re-announce itself.
 *
 * The handshake starts with the frame's `hello`, which it sends once on load. Without a ping, a
 * studio that remounts (a refresh, a hot reload, a route change) can never reconnect to an app that
 * is already running: the app has said hello, nobody was listening, and it has no reason to repeat
 * itself. The symptom is a preview stuck on "waiting" that only a reload of the APP fixes.
 */
export interface PingMessage {
  type: 'lighter:ping';
}

export interface AnnotateMessage {
  type: 'lighter:annotate';
  enabled: boolean;
}

/** Ask the app to re-measure one element by id — after a spec change moved it. */
export interface MeasureMessage {
  type: 'lighter:measure';
  elementId: string;
}

export type ParentMessage =
  | ReadyMessage
  | PingMessage
  | SpecMessage
  | TokensMessage
  | RefreshMessage
  | AnnotateMessage
  | MeasureMessage;

/* ── guards ─────────────────────────────────────────────────────────────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Narrow untrusted `MessageEvent.data` to a parent message. Anything else is ignored, not thrown. */
export function asParentMessage(data: unknown): ParentMessage | null {
  if (!isRecord(data)) return null;
  switch (data.type) {
    case 'lighter:ready':
      return typeof data.protocol === 'number' ? (data as unknown as ReadyMessage) : null;
    case 'lighter:spec':
      return typeof data.screenId === 'string' ? (data as unknown as SpecMessage) : null;
    case 'lighter:tokens':
      return typeof data.css === 'string' ? (data as unknown as TokensMessage) : null;
    case 'lighter:refresh':
      return data as unknown as RefreshMessage;
    case 'lighter:ping':
      return data as unknown as PingMessage;
    case 'lighter:annotate':
      return typeof data.enabled === 'boolean' ? (data as unknown as AnnotateMessage) : null;
    case 'lighter:measure':
      return typeof data.elementId === 'string' ? (data as unknown as MeasureMessage) : null;
    default:
      return null;
  }
}

/** Narrow untrusted `MessageEvent.data` to a frame message. */
export function asFrameMessage(data: unknown): FrameMessage | null {
  if (!isRecord(data)) return null;
  switch (data.type) {
    case 'lighter:hello':
      return typeof data.protocol === 'number' ? (data as unknown as HelloMessage) : null;
    case 'lighter:navigated':
      return data as unknown as NavigatedMessage;
    case 'lighter:error':
      return typeof data.message === 'string' ? (data as unknown as ErrorMessage) : null;
    case 'lighter:element':
      return data.kind === 'hover' || data.kind === 'select' || data.kind === 'measure'
        ? (data as unknown as ElementMessage)
        : null;
    case 'lighter:layout':
      return data as unknown as LayoutMessage;
    default:
      return null;
  }
}

/**
 * Whether this side can drive/be driven by the other. Same major version only — a mismatch is
 * reported to the user rather than papered over, because a half-working preview is worse than an
 * obviously broken one.
 */
export function isCompatible(theirProtocol: number): boolean {
  return theirProtocol === PROTOCOL_VERSION;
}
