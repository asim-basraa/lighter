import 'server-only';
import { apiBaseUrl } from './inventory.js';
import { apiAuthHeaders } from './session.js';
import {
  isValidOrigin,
  isLoopbackOrigin,
  LOOPBACK_SUGGESTIONS,
  type PreviewOrigin,
} from './originRules.js';

/**
 * Server-side access to the live-preview origin allowlist (#166), now per-project and managed in the
 * UI rather than an env var.
 *
 * The studio must never frame an origin supplied in a query string: that would turn a Lighter URL
 * into a redirector rendering someone else's content under Lighter's chrome — a credible phishing
 * surface — and would hand spec pushes to whatever answered the handshake. A query param may only
 * *select among* allowed origins.
 *
 * The rules themselves live in `originRules.ts` so the client picker and tests can share them
 * without crossing the server-only boundary.
 */
export type { PreviewOrigin } from './originRules.js';
export {
  isValidOrigin,
  isLoopbackOrigin,
  isMixedContentBlocked,
  LOOPBACK_SUGGESTIONS,
} from './originRules.js';

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
 * Resolve the origin to frame: the requested one if permitted, else the first configured, else a
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
