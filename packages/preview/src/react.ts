'use client';

import { useEffect, useRef, useState } from 'react';
import { connectPreview } from './client.js';

export interface LivePreviewState<T> {
  /** The spec to render: the live one when Lighter is driving, otherwise the app's own. */
  spec: T;
  /** True once a Lighter studio has completed the handshake. */
  connected: boolean;
}

/**
 * Subscribe a rendered screen to Lighter's live preview (#167).
 *
 * Returns the app's own spec until a studio connects and pushes one, so the component renders
 * normally in production and in any context where it isn't framed.
 *
 * `parse` both validates and NORMALISES: it returns the spec to store, or null to refuse. Returning
 * the parsed value matters — a spec arriving over the wire has been through JSON, so it carries
 * whatever the sender had. Storing the raw object would skip the schema boundary that assigns stable
 * element ids (#184), and the app would render elements with `undefined` ids that nothing can anchor
 * to. Refusing leaves the previous spec on screen and tells the studio.
 */
export function useLighterPreview<T>(
  initialSpec: T,
  options: {
    allowedOrigins: string[];
    screenId?: string | null;
    parse?: (spec: unknown) => T | null;
    onRefresh?: () => void;
  },
): LivePreviewState<T> {
  const [spec, setSpec] = useState<T>(initialSpec);
  const [connected, setConnected] = useState(false);

  // Keep handlers in a ref so re-renders don't tear down and re-handshake the channel.
  const handlers = useRef(options);
  handlers.current = options;

  // A new build/navigation supplies a new baseline spec; adopt it unless a studio is driving.
  useEffect(() => {
    if (!connected) setSpec(initialSpec);
  }, [initialSpec, connected]);

  useEffect(() => {
    const origins = handlers.current.allowedOrigins;
    const disconnect = connectPreview({
      allowedOrigins: origins,
      screenId: handlers.current.screenId,
      onConnection: setConnected,
      onRefresh: () => handlers.current.onRefresh?.(),
      onSpec: (incoming) => {
        const parse = handlers.current.parse;
        if (!parse) {
          setSpec(incoming as T);
          return true;
        }
        const parsed = parse(incoming);
        if (parsed === null) return false;
        setSpec(parsed);
        return true;
      },
    });
    return disconnect;
    // Origins are configuration, not state: join them so a stable list doesn't re-run this.
  }, [handlers.current.allowedOrigins.join(',')]);

  return { spec, connected };
}
