import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '../../../lib/supabase/server.js';

/**
 * Magic-link landing (#91). Supabase redirects here with a `code`; we exchange it for a session
 * (setting the auth cookies) and send the user on to `next` (the dashboard by default).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  if (code) {
    const supabase = supabaseServer();
    if (supabase) await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
