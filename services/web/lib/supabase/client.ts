'use client';

import { createBrowserClient } from '@supabase/ssr';

/** The Supabase config the root layout injected server-side (#144), avoiding NEXT_PUBLIC inlining. */
interface InjectedConfig {
  url: string;
  anonKey: string;
}
declare global {
  interface Window {
    __LIGHTER_SUPABASE__?: InjectedConfig;
  }
}

/**
 * The browser Supabase client for the login page (magic-link request + session handling). Reads the
 * config the server injected into `window.__LIGHTER_SUPABASE__` (falling back to `NEXT_PUBLIC_*` for
 * local dev). Only called from client components where Supabase is configured.
 */
export function supabaseBrowser() {
  const injected = typeof window !== 'undefined' ? window.__LIGHTER_SUPABASE__ : undefined;
  const url = injected?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = injected?.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, anonKey);
}
