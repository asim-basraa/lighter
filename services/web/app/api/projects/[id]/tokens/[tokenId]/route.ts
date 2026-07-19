import { NextResponse, type NextRequest } from 'next/server';
import { apiBaseUrl } from '../../../../../../lib/inventory.js';
import { accessToken } from '../../../../../../lib/session.js';

/** Revoke a project CLI token (#147). Owner-only — enforced by the API; this only forwards the JWT. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; tokenId: string } },
) {
  const jwt = await accessToken();
  if (!jwt)
    return NextResponse.json({ status: 'error', message: 'not signed in' }, { status: 401 });
  const path = `/projects/${encodeURIComponent(params.id)}/tokens/${encodeURIComponent(params.tokenId)}`;
  try {
    const res = await fetch(new URL(path, apiBaseUrl()), {
      method: 'DELETE',
      cache: 'no-store',
      headers: { authorization: `Bearer ${jwt}` },
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch (err) {
    console.error('token revoke proxy failed:', err);
    return NextResponse.json(
      { status: 'error', message: 'token service unavailable' },
      { status: 502 },
    );
  }
}
