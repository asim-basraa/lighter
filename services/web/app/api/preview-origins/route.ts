import { NextResponse } from 'next/server';
import { apiBaseUrl } from '../../../lib/inventory.js';
import { apiAuthHeaders } from '../../../lib/session.js';

/**
 * Same-origin proxy for the preview-origin allowlist (#166), so the browser can manage it without
 * ever holding the project credential — the token stays server-side, exactly as the rest of the
 * studio's writes work.
 */
export const dynamic = 'force-dynamic';

async function forward(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(new URL(path, apiBaseUrl()), {
    ...init,
    cache: 'no-store',
    headers: { ...(await apiAuthHeaders()), ...(init.headers as Record<string, string>) },
  });
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function GET() {
  return forward('/preview-origins', { method: 'GET' });
}

export async function POST(request: Request) {
  return forward('/preview-origins', {
    method: 'POST',
    body: await request.text(),
    headers: { 'content-type': 'application/json' },
  });
}

export async function DELETE(request: Request) {
  const origin = new URL(request.url).searchParams.get('origin') ?? '';
  return forward(`/preview-origins?origin=${encodeURIComponent(origin)}`, { method: 'DELETE' });
}
