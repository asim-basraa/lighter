/**
 * The per-version approval lifecycle (#25):
 *
 *   draft ──deploy──▶ shared ──request-changes──▶ changes-requested ──approve──▶ approved
 *                       │                                                          ▲
 *                       └───────────────────────approve────────────────────────────┘
 *
 * A version starts as `draft`, becomes `shared` when deployed to a review URL, and from there a
 * reviewer either requests changes or approves. `approved` is terminal.
 *
 * There is deliberately NO `changes-requested → shared` edge: versions are immutable, so addressing
 * feedback produces a NEW version (which starts at draft and is deployed on its own) rather than
 * re-sharing the same one. A `changes-requested` version can still be approved directly (feedback
 * turned out to be non-blocking). Illegal transitions are rejected by the routes.
 */
export type ApprovalState = 'draft' | 'shared' | 'changes-requested' | 'approved';

export const DEFAULT_STATE: ApprovalState = 'draft';

/** The states reachable in one step from each state. */
const ALLOWED: Record<ApprovalState, readonly ApprovalState[]> = {
  draft: ['shared'],
  shared: ['changes-requested', 'approved'],
  'changes-requested': ['approved'],
  approved: [],
};

const STATES = Object.keys(ALLOWED) as ApprovalState[];

/** Whether `to` is reachable from `from` in a single step. */
export function canTransition(from: ApprovalState, to: ApprovalState): boolean {
  return ALLOWED[from].includes(to);
}

/** Narrow an arbitrary value to a known approval state. */
export function isApprovalState(value: unknown): value is ApprovalState {
  return typeof value === 'string' && (STATES as string[]).includes(value);
}
