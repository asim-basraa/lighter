/**
 * Which app origins the studio may frame for live preview (#169).
 *
 * An allowlist, resolved server-side. The studio never frames a URL supplied in a query string — that
 * would make the studio a redirector for arbitrary content and hand any attacker a Lighter-branded
 * frame to put a login form in.
 *
 * Configure with `LIGHTER_PREVIEW_ORIGINS` (comma-separated). Defaults to the local shop so the
 * authoring loop works with no setup.
 */
const DEFAULT_ORIGINS = ['http://localhost:4200'];

export function previewOrigins(): string[] {
  const configured = process.env.LIGHTER_PREVIEW_ORIGINS;
  const list = configured
    ? configured.split(',').map((o) => o.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;
  return list.filter(isValidOrigin);
}

/** An origin only — scheme + host + optional port, no path, query or fragment. */
export function isValidOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.origin === value.replace(/\/$/, '') && url.pathname === '/';
  } catch {
    return false;
  }
}

/** Resolve a requested origin against the allowlist; falls back to the first allowed one. */
export function resolvePreviewOrigin(requested: string | undefined): string | null {
  const allowed = previewOrigins();
  if (allowed.length === 0) return null;
  if (requested && allowed.includes(requested)) return requested;
  return allowed[0]!;
}

/**
 * Whether this studio page can frame that origin at all.
 *
 * A page served over https cannot embed an http frame — browsers block mixed content, and localhost
 * is no exception. Surfacing this as a first-class state matters: otherwise a hosted studio pointed
 * at a dev server shows an empty rectangle with nothing in the console to explain it.
 */
export function isMixedContentBlocked(studioProto: string, targetOrigin: string): boolean {
  return studioProto === 'https:' && targetOrigin.startsWith('http://');
}
