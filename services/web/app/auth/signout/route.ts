import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '../../../lib/supabase/server.js';

/** Sign out (#91): clear the Supabase session and return to the login page. */
export async function POST(request: NextRequest) {
  const supabase = supabaseServer();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', new URL(request.url).origin), { status: 303 });
}
