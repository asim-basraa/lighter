import 'server-only';

/**
 * Which Lighter studios may drive this app, read at REQUEST time (#179).
 *
 * Server-side on purpose. The obvious alternative — a `NEXT_PUBLIC_*` variable read in the client
 * component — is inlined by Next at build time, so the value gets baked into the container image and
 * repointing the app at a different studio means a rebuild. That is exactly the trap that cost time
 * on the studio service (#140/#144).
 *
 * Configured, never inferred: an app must name who is allowed to control it. Defaults to the local
 * studio so `pnpm dev` needs no setup.
 */
export function studioOrigins(): string[] {
  const configured =
    process.env.LIGHTER_STUDIO_ORIGINS ?? process.env.NEXT_PUBLIC_LIGHTER_STUDIO_ORIGINS;
  if (configured) {
    return configured
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return ['http://localhost:4000'];
}
