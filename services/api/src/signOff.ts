import type { SignOffPartyInput } from '@lighter/db';

/** The sign-off roles. A valid set needs at least one of each (a customer and an internal owner). */
export const SIGN_OFF_ROLES = ['customer', 'internal'] as const;
export type SignOffRole = (typeof SIGN_OFF_ROLES)[number];

/**
 * Validate a proposed sign-off set (#26): every party has a non-empty id and a known role, party ids
 * are unique, and the set includes at least one customer and one internal owner. Returns a reason on
 * failure so the route can 400 with it.
 */
export function validateSignOffSet(
  parties: SignOffPartyInput[],
): { ok: true } | { ok: false; message: string } {
  const seen = new Set<string>();
  for (const p of parties) {
    if (typeof p.party !== 'string' || p.party.trim().length === 0) {
      return { ok: false, message: 'each party needs a non-empty id' };
    }
    if (!(SIGN_OFF_ROLES as readonly string[]).includes(p.role)) {
      return { ok: false, message: `role must be one of: ${SIGN_OFF_ROLES.join(', ')}` };
    }
    if (seen.has(p.party)) {
      return { ok: false, message: `duplicate party "${p.party}"` };
    }
    seen.add(p.party);
  }
  const hasCustomer = parties.some((p) => p.role === 'customer');
  const hasInternal = parties.some((p) => p.role === 'internal');
  if (!hasCustomer || !hasInternal) {
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
