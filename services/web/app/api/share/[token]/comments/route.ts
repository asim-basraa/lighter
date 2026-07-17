import { apiBaseUrl } from '../../../../../lib/inventory.js';

/**
 * Same-origin proxy for posting a review comment from the browser. The client can't call the Lighter
 * API directly (its base URL is a server-only env var), so the CommentsPanel POSTs here and this
 * handler forwards to `POST {LIGHTER_API_URL}/share/:token/comments`, passing the API's status and
 * body straight back. Read paths stay server-rendered on the share page.
 */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { token: string } },
): Promise<Response> {
  const body = await req.text();
  const upstream = await fetch(
    new URL(`/share/${encodeURIComponent(params.token)}/comments`, apiBaseUrl()),
    { method: 'POST', headers: { 'content-type': 'application/json' }, body, cache: 'no-store' },
  );
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  });
}
