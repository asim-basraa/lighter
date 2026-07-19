/**
 * The studio's PUBLIC origin for a request (#149).
 *
 * Behind a proxy (Railway, and most container hosts) `request.url` carries the container's internal
 * bind address — e.g. `http://0.0.0.0:8080` — so building a redirect from it sends the user to an
 * unreachable host. The proxy forwards the real scheme/host in `x-forwarded-proto`/`x-forwarded-host`;
 * prefer those, then `host`, and only fall back to the request's own origin (correct for local dev).
 */
export function publicOrigin(request: { url: string; headers: Headers }): string {
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (forwardedHost) {
    // A proxy may forward a comma-separated chain; the first entry is the original client-facing host.
    const host = forwardedHost.split(',')[0]!.trim();
    const proto = (request.headers.get('x-forwarded-proto') ?? 'https').split(',')[0]!.trim();
    if (host) return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}
