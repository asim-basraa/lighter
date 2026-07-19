import { NextResponse, type NextRequest } from 'next/server';
import { apiBaseUrl } from '../../../../lib/inventory.js';
import { apiAuthHeaders } from '../../../../lib/session.js';

/**
 * Same-origin proxy for the project's screen routes (#156), so the browser can save a version,
 * deploy, approve or request changes without ever holding the session token. The signed-in user's
 * JWT + `X-Lighter-Project` are attached server-side (see `lib/session`), and the API enforces
 * membership — this layer adds no authorization of its own.
 *
 * Only `/screens/**` is reachable: the segment comes from the route's own catch-all, and each part is
 * re-encoded, so a caller can't traverse to another API surface.
 */
function targetUrl(path: string[]): URL {
  const suffix = path.map(encodeURIComponent).join('/');
  return new URL(`/screens/${suffix}`, apiBaseUrl());
}

async function forward(
  request: NextRequest,
  path: string[],
  method: 'GET' | 'POST' | 'PUT',
): Promise<NextResponse> {
  const auth = await apiAuthHeaders();
  if (!auth.authorization) {
    return NextResponse.json({ status: 'error', message: 'not signed in' }, { status: 401 });
  }
  const body = method === 'GET' ? undefined : (await request.text()) || '{}';
  try {
    const res = await fetch(targetUrl(path), {
      method,
      cache: 'no-store',
      headers: { ...auth, 'content-type': 'application/json' },
      body,
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch (err) {
    console.error('screens proxy failed:', err);
    return NextResponse.json(
      { status: 'error', message: 'screens service unavailable' },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path, 'POST');
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(request, params.path, 'PUT');
}
