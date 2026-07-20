/**
 * What counts as a previewable origin (#166).
 *
 * Deliberately free of `server-only`: the same rules are needed by the server (which enforces them),
 * by the client origin picker (which shouldn't offer something the server will refuse), and by tests.
 * The server-only fetchers live in `previewOrigins.ts` and build on these.
 *
 * These mirror the API's rules in `@lighter/db`. Both sides must agree on what an origin *is*, or the
 * studio offers to frame something the server rejects — or, worse, the reverse.
 */

export interface PreviewOrigin {
  origin: string;
  label: string | null;
  createdAt: string;
}

/**
 * A bare origin — scheme + host + optional port. A path, query, fragment or credentials are rejected
 * rather than silently truncated: if a caller wrote `https://evil.com/login` they meant something
 * other than `https://evil.com`, and should be told rather than handed the neighbour.
 */
export function isValidOrigin(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.search || url.hash) return false;
  if (url.pathname !== '/') return false;
  return url.origin === value.replace(/\/$/, '');
}

/**
 * Points at the local machine — always previewable without being allowlisted, because it can only
 * ever expose the person who opened it and can't be meaningfully shared.
 */
export function isLoopbackOrigin(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

/** Loopback origins offered without configuration, so the authoring loop needs no setup. */
export const LOOPBACK_SUGGESTIONS = ['http://localhost:4200', 'http://localhost:3000'];

/**
 * Whether a studio page on `studioProto` can frame `targetOrigin`.
 *
 * An HTTPS page cannot embed an HTTP frame — browsers block mixed content, and `localhost` is no
 * exception. Surfacing this explicitly matters: otherwise a hosted studio pointed at a dev server
 * shows an empty rectangle with nothing in the console to explain it.
 */
export function isMixedContentBlocked(studioProto: string, targetOrigin: string): boolean {
  return studioProto === 'https:' && targetOrigin.startsWith('http://');
}
