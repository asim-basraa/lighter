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
export interface ScreenMeta {
  id: string;
  name: string;
}
export interface ScreenDetail extends ScreenMeta {
  versions: number[];
}
export interface GenerateResult {
  spec: unknown;
  attempts: number;
}
export interface DeployResult {
  token: string;
  expiresAt: string | null;
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

  /** Create a screen (`POST /screens`). */
  createScreen(name: string): Promise<ScreenMeta> {
    return this.json<ScreenMeta>('/screens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  }

  /** A screen's metadata + its version numbers (`GET /screens/:id`). */
  getScreen(id: string): Promise<ScreenDetail> {
    return this.json<ScreenDetail>(`/screens/${id}`);
  }

  /** Save a new immutable spec version (`POST /screens/:id/versions`). */
  saveVersion(id: string, spec: unknown): Promise<{ version: number }> {
    return this.json<{ version: number }>(`/screens/${id}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spec }),
    });
  }

  /** Generate a catalog-constrained spec from an intent (`POST /generate`). */
  generate(intent: string): Promise<GenerateResult> {
    return this.json<GenerateResult>('/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intent }),
    });
  }

  /** Deploy a version to a share link (`POST /screens/:id/versions/:version/share`). */
  deploy(id: string, version: number, expiresInSeconds?: number): Promise<DeployResult> {
    return this.json<DeployResult>(`/screens/${id}/versions/${version}/share`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(expiresInSeconds !== undefined ? { expiresInSeconds } : {}),
    });
  }

  /** The public review URL for a share token (the API's `/share/:token` seam). */
  shareUrl(token: string): string {
    return `${this.config.url.replace(/\/$/, '')}/share/${token}`;
  }
}
