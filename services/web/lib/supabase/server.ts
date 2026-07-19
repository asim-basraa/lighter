import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseEnv } from './env.js';

/**
 * A Supabase client bound to the request's cookies, for server components / route handlers / the
 * middleware. Returns null when Supabase Auth is not configured. The `setAll` write is wrapped because
 * a pure Server Component cannot mutate cookies — that's fine, the middleware refreshes the session.
 */
export function supabaseServer() {
  const env = supabaseEnv();
  if (!env) return null;
  const store = cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Called from a Server Component (read-only cookies); the middleware handles the refresh.
        }
      },
    },
  });
}
