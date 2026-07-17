/**
 * The notification boundary (#29). A `Notifier` delivers events to a configurable target (chat /
 * tracker) so the team isn't polling the review surface. It's injected into the app the same way the
 * LLM client is, so tests never make real network calls and the delivery target is swappable.
 */

/** A reviewer left a comment on a version. */
export interface CommentNotification {
  kind: 'comment';
  screenId: string;
  version: number;
  elementId: string;
  author: string | null;
  body: string;
}

/** A version was approved. */
export interface ApprovalNotification {
  kind: 'approval';
  screenId: string;
  version: number;
}

export type Notification = CommentNotification | ApprovalNotification;

export interface Notifier {
  notify(event: Notification): Promise<void>;
}

/**
 * Deliver an event without ever breaking the primary action: a missing notifier is a no-op, and a
 * delivery failure is logged, not thrown. Comments and approvals must succeed even if the chat/tracker
 * is unreachable.
 */
export async function safeNotify(
  notifier: Notifier | undefined,
  event: Notification,
): Promise<void> {
  if (!notifier) return;
  try {
    await notifier.notify(event);
  } catch (err) {
    console.error('notification delivery failed:', err);
  }
}

/**
 * A notifier that POSTs each event as JSON to a configured webhook (Slack/Discord/tracker inbound
 * URL). The URL is the configurable delivery target. Network-touching, so excluded from coverage;
 * behavior is exercised via the injected fake in tests.
 */
/* c8 ignore start */
export class WebhookNotifier implements Notifier {
  constructor(private readonly url: string) {}

  async notify(event: Notification): Promise<void> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      throw new Error(`webhook returned ${res.status}`);
    }
  }
}
/* c8 ignore stop */
