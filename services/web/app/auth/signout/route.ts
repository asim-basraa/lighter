import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '../../../lib/supabase/server.js';
import { publicOrigin } from '../../../lib/publicOrigin.js';

/**
 * Sign out (#91): clear the Supabase session and return to the login page. Uses the PUBLIC origin
 * (#149) so the redirect works behind a proxy, not the container's internal bind address.
 */
export async function POST(request: NextRequest) {
  const supabase = supabaseServer();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', publicOrigin(request)), { status: 303 });
}
