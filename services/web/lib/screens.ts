import 'server-only';
import { apiBaseUrl } from './inventory.js';
import { apiAuthHeaders } from './session.js';
import { SpecSchema, type Spec } from '@lighter/spec';

/** A screen as the API lists it. */
export interface ScreenSummary {
  id: string;
  name: string;
}

/** A screen with its version numbers. */
export interface ScreenDetail extends ScreenSummary {
  versions: number[];
}

/** Per-version approval state (the API defaults an unstored version to 'draft'). */
export type ApprovalState = 'draft' | 'shared' | 'changes-requested' | 'approved';

/** One comment thread root with its replies, as the aggregation endpoint returns them. */
export interface CommentNode {
  id: number;
  body: string;
  author: string | null;
  createdAt: string;
  replies?: CommentNode[];
}
export interface ElementComments {
  elementId: string;
  threads: CommentNode[];
}
export interface VersionComments {
  version: number;
  elements: ElementComments[];
}

async function get<T>(path: string): Promise<T | null> {
  const headers = await apiAuthHeaders();
  try {
    const res = await fetch(new URL(path, apiBaseUrl()), { cache: 'no-store', headers });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Every screen in the current project. */
export async function listScreens(): Promise<ScreenSummary[]> {
  return (await get<ScreenSummary[]>('/screens')) ?? [];
}

/** One screen with its versions, or null if it doesn't exist in this project. */
export async function getScreen(id: string): Promise<ScreenDetail | null> {
  return get<ScreenDetail>(`/screens/${encodeURIComponent(id)}`);
}

/** A specific version's spec. */
export async function getVersionSpec(
  id: string,
  version: number,
): Promise<{ version: number; spec: Spec } | null> {
  const res = await get<{ version: number; spec: unknown }>(
    `/screens/${encodeURIComponent(id)}/versions/${version}`,
  );
  if (!res) return null;
  // Parse at the boundary. A spec arrives here as plain JSON over HTTP, so this is the only place
  // stable element ids get assigned (#184) — and it also migrates a spec stored by an older API.
  return { version: res.version, spec: SpecSchema.parse(res.spec) };
}

/**
 * The screen's working draft, or null if there isn't one (#166).
 *
 * The editor writes here rather than minting a version per keystroke; a draft is promoted to an
 * immutable version on push.
 */
export async function getDraft(id: string): Promise<Spec | null> {
  const res = await get<{ spec: unknown }>(`/screens/${encodeURIComponent(id)}/draft`);
  return res ? SpecSchema.parse(res.spec) : null;
}

/** A version's approval state. */
export async function getVersionState(id: string, version: number): Promise<ApprovalState> {
  const res = await get<{ version: number; state: ApprovalState }>(
    `/screens/${encodeURIComponent(id)}/versions/${version}/status`,
  );
  return res?.state ?? 'draft';
}

/** Comments across every version of a screen, grouped version → element → threads. */
export async function getScreenComments(id: string): Promise<VersionComments[]> {
  const res = await get<{ screen: string; versions: VersionComments[] }>(
    `/screens/${encodeURIComponent(id)}/comments`,
  );
  return res?.versions ?? [];
}
