import 'server-only';
import { cookies } from 'next/headers';
import { supabaseServer } from './supabase/server.js';
import { authEnabled } from './supabase/env.js';

/** Cookie holding the project the user is currently acting within (the `X-Lighter-Project` value). */
export const PROJECT_COOKIE = 'lighter_project';

export interface SessionUser {
  id: string;
  email: string | null;
}

/** The signed-in user, or null. Uses getUser() (verifies the JWT) rather than trusting the cookie. */
export async function currentUser(): Promise<SessionUser | null> {
  const sb = supabaseServer();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** The current access token (the JWT sent to the Lighter API), or null. */
export async function accessToken(): Promise<string | null> {
  const sb = supabaseServer();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

/** The project the user has selected (from the cookie), or null. */
export function selectedProjectId(): string | null {
  return cookies().get(PROJECT_COOKIE)?.value ?? null;
}

/**
 * The auth headers the studio's server-side fetchers attach when calling the Lighter API.
 *  - Supabase mode: the user's JWT + the selected project (the human lane).
 *  - Pre-auth fallback: a `LIGHTER_TOKEN` project token (the Phase 0 single-project stopgap).
 *  - Neither: no headers → the caller reads the (empty) global endpoint.
 */
export async function apiAuthHeaders(): Promise<Record<string, string>> {
  if (authEnabled()) {
    const [token, project] = [await accessToken(), selectedProjectId()];
    if (token && project) {
      return { authorization: `Bearer ${token}`, 'x-lighter-project': project };
    }
    return {};
  }
  const token = process.env.LIGHTER_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}
