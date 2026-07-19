/**
 * Supabase Auth config for the studio (#91). Both values are public-by-design (the anon key is meant
 * to ship to the browser). When they're absent the studio runs in its pre-auth mode: no login gate,
 * and data reads fall back to the `LIGHTER_TOKEN` single-project path (or the global endpoints). This
 * keeps local dev, the test suite, and any non-Supabase deployment working unchanged.
 *
 * Read at RUNTIME from server env (`SUPABASE_URL` / `SUPABASE_ANON_KEY`), with the `NEXT_PUBLIC_*`
 * names as a fallback (#144). This deliberately avoids depending on build-time `NEXT_PUBLIC` inlining:
 * Railway (and other Docker hosts) don't reliably pass service vars as build args, so the runtime
 * names are the reliable path. The browser gets these values injected by the root layout (they're
 * server-read there), so the client never depends on `NEXT_PUBLIC` inlining either.
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function supabaseEnv(): SupabaseEnv | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** True when Supabase Auth is configured — the studio should gate on login and use the JWT lane. */
export function authEnabled(): boolean {
  return supabaseEnv() !== null;
}
