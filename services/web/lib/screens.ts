import 'server-only';
import { apiBaseUrl } from './inventory.js';
import { apiAuthHeaders } from './session.js';
import type { Spec } from '@lighter/spec';

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
  return get(`/screens/${encodeURIComponent(id)}/versions/${version}`);
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
