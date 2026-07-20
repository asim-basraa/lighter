import { NextResponse } from 'next/server';
import { getVersionSpec } from '../../../../../../lib/screens.js';

/**
 * A stored version's spec, for the live-preview rail's version switcher (#169).
 *
 * Same-origin and server-credentialed: the browser never holds the project token, and this only ever
 * reads a version of a screen the current session can already see.
 */
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string; v: string } }) {
  const version = Number(params.v);
  if (!Number.isInteger(version) || version < 1) {
    return NextResponse.json({ error: 'Invalid version' }, { status: 400 });
  }
  const res = await getVersionSpec(params.id, version);
  if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(res);
}
