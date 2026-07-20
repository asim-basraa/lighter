import { SpecSchema, type Spec } from '@lighter/spec';
import { apiBaseUrl } from './inventory.js';

/** A click-through flow link to another screen's deployed mock (#30). `token` is null if undeployed. */
export interface FlowLink {
  label: string;
  targetScreenId: string;
  token: string | null;
}

/** A deployed mock: the screen it belongs to, the version, the spec to render, and its deploy time. */
export interface SharedVersion {
  screen: { id: string; name: string };
  version: number;
  spec: Spec;
  /** When this version was deployed — shown in the prototype banner. */
  deployedAt: string;
  /** Click-through navigation to other screens in the flow (#30). */
  flow: FlowLink[];
}

/** The shared version plus a load error, if any — mirrors `LoadedInventory` so the page degrades. */
export interface LoadedShare {
  share: SharedVersion | null;
  error: string | null;
}

/** A zero-arg request to the share endpoint, returning a `fetch`-style Response. */
export type ShareFetcher = () => Response | Promise<Response>;

/** The default production fetcher: `GET {LIGHTER_API_URL}/share/:token`, uncached. */
export function apiShareFetcher(token: string, baseUrl: string = apiBaseUrl()): ShareFetcher {
  return () =>
    fetch(new URL(`/share/${encodeURIComponent(token)}`, baseUrl), { cache: 'no-store' });
}

/**
 * Load a deployed mock by its share token. A 404 (unknown or expired token) becomes a "not found"
 * error rather than a thrown exception, so the public share page renders a clean message instead of
 * crashing; any other failure is folded into `error` the same way.
 */
export async function loadShare(
  token: string,
  fetcher: ShareFetcher = apiShareFetcher(token),
): Promise<LoadedShare> {
  try {
    const res = await fetcher();
    if (res.status === 404) {
      return { share: null, error: 'This shared mock was not found. The link may be invalid.' };
    }
    if (!res.ok) {
      throw new Error(`Share API returned ${res.status}`);
    }
    const body = (await res.json()) as SharedVersion;
    // Parse the spec at the boundary — this is where stable element ids are assigned (#184), and
    // the review surface's annotation layer keys off them.
    return { share: { ...body, spec: SpecSchema.parse(body.spec) }, error: null };
  } catch (err) {
    // This surface is public, so the viewer-facing message stays generic; the technical detail is
    // logged server-side (never sent to an unauthenticated external viewer).
    console.error('Failed to load shared mock:', err);
    return { share: null, error: 'Something went wrong loading this shared mock.' };
  }
}
