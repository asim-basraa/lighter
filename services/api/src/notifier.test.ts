import { describe, it, expect, vi } from 'vitest';
import { safeNotify, type Notifier, type Notification } from './notifier.js';

describe('safeNotify', () => {
  it('does nothing when no notifier is configured', async () => {
    // Should not throw with an undefined notifier.
    await safeNotify(undefined, { kind: 'approval', screenId: 'home', version: 1 });
  });

  it('forwards the event to the notifier', async () => {
    const sent: Notification[] = [];
    const notifier: Notifier = {
      async notify(n) {
        sent.push(n);
      },
    };
    await safeNotify(notifier, { kind: 'approval', screenId: 'home', version: 2 });
    expect(sent).toEqual([{ kind: 'approval', screenId: 'home', version: 2 }]);
  });

  it('swallows a notifier failure so the primary action is never broken', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notifier: Notifier = {
      async notify() {
        throw new Error('webhook down');
      },
    };
    // Must resolve, not reject.
    await expect(
      safeNotify(notifier, {
        kind: 'comment',
        screenId: 'home',
        version: 1,
        elementId: 'el-0',
        author: null,
        body: 'hi',
        parentId: null,
      }),
    ).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
