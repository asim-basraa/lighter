import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isApprovalState,
  DEFAULT_STATE,
  type ApprovalState,
} from './approvalState.js';

describe('approval state machine (#25)', () => {
  it('defaults to draft', () => {
    expect(DEFAULT_STATE).toBe('draft');
  });

  it('allows the legal transitions', () => {
    expect(canTransition('draft', 'shared')).toBe(true);
    expect(canTransition('shared', 'changes-requested')).toBe(true);
    expect(canTransition('shared', 'approved')).toBe(true);
    expect(canTransition('changes-requested', 'approved')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('draft', 'approved')).toBe(false); // must be shared first
    expect(canTransition('draft', 'changes-requested')).toBe(false);
    expect(canTransition('approved', 'shared')).toBe(false); // approved is terminal
    expect(canTransition('approved', 'changes-requested')).toBe(false);
    expect(canTransition('shared', 'draft')).toBe(false);
    // No re-share: an immutable version's fix is a new version, not a re-open of this one.
    expect(canTransition('changes-requested', 'shared')).toBe(false);
  });

  it('recognizes valid state strings', () => {
    expect(isApprovalState('approved')).toBe(true);
    expect(isApprovalState('nonsense')).toBe(false);
    const s: ApprovalState = 'draft';
    expect(isApprovalState(s)).toBe(true);
  });
});
