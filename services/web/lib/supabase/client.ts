'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * The browser Supabase client for the login page (magic-link request + session handling). Reads the
 * public env inlined at build time. Only called from client components where Supabase is configured.
 */
export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, anonKey);
}
