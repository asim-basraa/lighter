/**
 * Supabase Auth config for the studio (#91). Both values are public-by-design (the anon key is meant
 * to ship to the browser). When they're absent the studio runs in its pre-auth mode: no login gate,
 * and data reads fall back to the `LIGHTER_TOKEN` single-project path (or the global endpoints). This
 * keeps local dev, the test suite, and any non-Supabase deployment working unchanged.
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function supabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** True when Supabase Auth is configured — the studio should gate on login and use the JWT lane. */
export function authEnabled(): boolean {
  return supabaseEnv() !== null;
}
