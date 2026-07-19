import { NextResponse, type NextRequest } from 'next/server';
import { apiBaseUrl } from '../../../../../lib/inventory.js';
import { accessToken } from '../../../../../lib/session.js';

/**
 * Same-origin proxy for a project's CLI tokens (#147). The signed-in user's Supabase JWT is attached
 * server-side and never reaches the browser (mirrors the /api/share comment proxy). The API enforces
 * owner-only access, so this adds no authorization of its own — it just forwards.
 */
async function forward(
  request: NextRequest,
  projectId: string,
  init: { method: string; body?: string },
): Promise<NextResponse> {
  const jwt = await accessToken();
  if (!jwt)
    return NextResponse.json({ status: 'error', message: 'not signed in' }, { status: 401 });
  try {
    const res = await fetch(
      new URL(`/projects/${encodeURIComponent(projectId)}/tokens`, apiBaseUrl()),
      {
        method: init.method,
        cache: 'no-store',
        headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
        body: init.body,
      },
    );
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch (err) {
    console.error('token proxy failed:', err);
    return NextResponse.json(
      { status: 'error', message: 'token service unavailable' },
      { status: 502 },
    );
  }
}

/** List the project's tokens (metadata only — never the raw token). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return forward(request, params.id, { method: 'GET' });
}

/** Mint a new CLI token. The raw token is returned ONCE, for the caller to copy. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.text();
  return forward(request, params.id, { method: 'POST', body: body || '{}' });
}
