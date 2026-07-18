import type { LighterConfig } from './config.js';

/** The fetch shape the client depends on — the global `fetch` in prod, a fake in tests. */
export type FetchFn = typeof fetch;

/** Thrown when the API returns a non-2xx response. Carries the status for callers that care. */
export class LighterApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface WhoAmI {
  id: string;
  name: string;
}
export interface InventorySummary {
  components: unknown[];
  tokens: unknown[];
}
export interface PushResult {
  status: string;
  model: { components: { name: string }[]; tokens: unknown[] };
}

/**
 * A thin typed client over the cloud Lighter HTTP API. Auth is the project bearer token from config.
 * `fetch` is injectable so tests drive it against an in-process Hono app (or a stub) with no network.
 */
export class LighterClient {
  constructor(
    private readonly config: LighterConfig,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (this.config.token) headers.authorization = `Bearer ${this.config.token}`;
    const base = this.config.url.replace(/\/$/, '');
    return this.fetchFn(`${base}${path}`, { ...init, headers });
  }

  private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.request(path, init);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new LighterApiError(
        `${init.method ?? 'GET'} ${path} → ${res.status}${detail ? `: ${detail}` : ''}`,
        res.status,
      );
    }
    return (await res.json()) as T;
  }

  /** The authenticated project (`GET /projects/me`). */
  whoami(): Promise<WhoAmI> {
    return this.json<WhoAmI>('/projects/me');
  }

  /** The project's latest pushed inventory (`GET /projects/inventory`). */
  inventory(): Promise<InventorySummary> {
    return this.json<InventorySummary>('/projects/inventory');
  }

  /** Push built design-system artifacts to the cloud (`POST /inventory`). */
  pushInventory(catalog: unknown, tokens: unknown): Promise<PushResult> {
    return this.json<PushResult>('/inventory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ catalog, tokens }),
    });
  }
}
