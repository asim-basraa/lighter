import 'server-only';
import { apiBaseUrl } from './inventory.js';
import { accessToken } from './session.js';

/** A project the signed-in user belongs to (from the API's `GET /projects`). */
export interface ProjectSummary {
  id: string;
  name: string;
  role: 'owner' | 'member';
}

/** The projects the current user is a member of. Empty when not signed in or on error. */
export async function listMyProjects(): Promise<ProjectSummary[]> {
  const token = await accessToken();
  if (!token) return [];
  try {
    const res = await fetch(new URL('/projects', apiBaseUrl()), {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return (await res.json()) as ProjectSummary[];
  } catch {
    return [];
  }
}

/** Create a project (the caller becomes its owner). Returns the new project or an error message. */
export async function createProjectApi(name: string): Promise<ProjectSummary | { error: string }> {
  const token = await accessToken();
  if (!token) return { error: 'not signed in' };
  const res = await fetch(new URL('/projects', apiBaseUrl()), {
    method: 'POST',
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    return { error: body.message ?? 'could not create project' };
  }
  return (await res.json()) as ProjectSummary;
}
