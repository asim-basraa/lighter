import 'server-only';
import { apiBaseUrl } from './inventory.js';
import { apiAuthHeaders } from './session.js';

/**
 * The live-preview origin allowlist (#166), now per-project and managed in the UI rather than an
 * env var.
 *
 * The studio must never frame an origin supplied in a query string. That would turn a Lighter URL
 * into a redirector rendering someone else's content under Lighter's chrome — a credible phishing
 * surface — and would hand spec pushes to whatever answered the handshake. A query param may only
 * *select among* allowed origins.
 */
export interface PreviewOrigin {
  origin: string;
  label: string | null;
  createdAt: string;
}

/** A bare origin — scheme + host + optional port. Mirrors the API's rule; see @lighter/db. */
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

/** Points at the local machine — always previewable, because it can only expose its own author. */
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

export async function listPreviewOrigins(): Promise<PreviewOrigin[]> {
  try {
    const res = await fetch(new URL('/preview-origins', apiBaseUrl()), {
      cache: 'no-store',
      headers: await apiAuthHeaders(),
    });
    if (!res.ok) return [];
    return (await res.json()) as PreviewOrigin[];
  } catch {
    return [];
  }
}

/**
 * Resolve the origin to frame: the requested one if allowed, else the first configured, else a
 * loopback default. Returns null only when there is genuinely nothing to frame.
 */
export async function resolvePreviewOrigin(
  requested: string | undefined,
): Promise<{ origin: string | null; allowed: PreviewOrigin[] }> {
  const allowed = await listPreviewOrigins();
  const permitted = (value: string) =>
    isValidOrigin(value) && (isLoopbackOrigin(value) || allowed.some((o) => o.origin === value));

  if (requested && permitted(requested)) return { origin: requested, allowed };
  if (allowed.length > 0) return { origin: allowed[0]!.origin, allowed };
  return { origin: LOOPBACK_SUGGESTIONS[0]!, allowed };
}

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
