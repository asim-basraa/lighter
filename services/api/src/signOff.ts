import type { SignOffPartyInput } from '@lighter/db';

/** The sign-off roles. A valid set needs at least one of each (a customer and an internal owner). */
export const SIGN_OFF_ROLES = ['customer', 'internal'] as const;
export type SignOffRole = (typeof SIGN_OFF_ROLES)[number];

/**
 * Validate a proposed sign-off set (#26): every element is an object with a non-empty party id and a
 * known role, party ids are unique, and the set includes at least one customer and one internal
 * owner. Takes `unknown[]` (the raw request body) and narrows defensively — a malformed element is a
 * 400, never a thrown 500. Returns a reason on failure so the route can 400 with it.
 */
export function validateSignOffSet(
  parties: readonly unknown[],
): { ok: true } | { ok: false; message: string } {
  const seen = new Set<string>();
  const roles: string[] = [];
  for (const raw of parties) {
    if (raw === null || typeof raw !== 'object') {
      return { ok: false, message: 'each party must be an object with a party id and role' };
    }
    const p = raw as { party?: unknown; role?: unknown };
    if (typeof p.party !== 'string' || p.party.trim().length === 0) {
      return { ok: false, message: 'each party needs a non-empty id' };
    }
    if (typeof p.role !== 'string' || !(SIGN_OFF_ROLES as readonly string[]).includes(p.role)) {
      return { ok: false, message: `role must be one of: ${SIGN_OFF_ROLES.join(', ')}` };
    }
    if (seen.has(p.party)) {
      return { ok: false, message: `duplicate party "${p.party}"` };
    }
    seen.add(p.party);
    roles.push(p.role);
  }
  if (!roles.includes('customer') || !roles.includes('internal')) {
    return {
      ok: false,
      message: 'sign-off set needs at least one customer and one internal owner',
    };
  }
  return { ok: true };
}

/** The required parties that have not yet signed off (order follows the required set). */
export function missingSignOffs(required: SignOffPartyInput[], signed: string[]): string[] {
  const signedSet = new Set(signed);
  return required.filter((r) => !signedSet.has(r.party)).map((r) => r.party);
}
