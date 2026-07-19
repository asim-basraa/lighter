import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseEnv } from './lib/supabase/env.js';

/**
 * Auth gate + session refresh (#91). When Supabase Auth is configured, every studio (dashboard) route
 * requires a signed-in user; the public review surface (`/share/*`, its comment proxy) and the auth
 * routes stay open. When Supabase is not configured the middleware is a no-op, so the pre-auth studio
 * (and the test suite) is unchanged.
 */
export async function middleware(request: NextRequest) {
  const env = supabaseEnv();
  if (!env) return NextResponse.next();

  const path = request.nextUrl.pathname;
  // Public paths: the reviewer surface + auth flow. No session needed (and no Supabase call).
  if (
    path.startsWith('/login') ||
    path.startsWith('/auth') ||
    path.startsWith('/share') ||
    path.startsWith('/api/share')
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Run on everything except Next internals + static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
