import type { CSSProperties } from 'react';
import { DashboardView } from '../../../components/DashboardView.js';
import { TokenManager, type TokenInfo } from '../../../components/TokenManager.js';
import { apiBaseUrl } from '../../../lib/inventory.js';
import { accessToken, selectedProjectId } from '../../../lib/session.js';
import { listMyProjects } from '../../../lib/projects.js';
import { authEnabled } from '../../../lib/supabase/env.js';

/**
 * Project settings (#147): manage the CLI tokens that let `lighter` and CI act on this project.
 * Owner-only (the API enforces it); non-owners see a note. Pre-auth deployments have no session, so
 * the page explains that instead of erroring.
 */
export const dynamic = 'force-dynamic';

async function loadTokens(projectId: string): Promise<{ tokens: TokenInfo[]; forbidden: boolean }> {
  const jwt = await accessToken();
  if (!jwt) return { tokens: [], forbidden: true };
  try {
    const res = await fetch(
      new URL(`/projects/${encodeURIComponent(projectId)}/tokens`, apiBaseUrl()),
      {
        cache: 'no-store',
        headers: { authorization: `Bearer ${jwt}` },
      },
    );
    if (res.status === 403) return { tokens: [], forbidden: true };
    if (!res.ok) return { tokens: [], forbidden: false };
    return { tokens: (await res.json()) as TokenInfo[], forbidden: false };
  } catch {
    return { tokens: [], forbidden: false };
  }
}

export default async function SettingsPage() {
  if (!authEnabled()) {
    return (
      <DashboardView title="Settings" error={null}>
        <p style={muted}>
          Sign-in is not configured for this deployment, so there is no project to manage.
        </p>
      </DashboardView>
    );
  }

  const projectId = selectedProjectId();
  const projects = await listMyProjects();
  const current = projects.find((p) => p.id === projectId);
  if (!projectId || !current) {
    return (
      <DashboardView title="Settings" error={null}>
        <p style={muted}>Choose a project first.</p>
      </DashboardView>
    );
  }

  const { tokens, forbidden } = await loadTokens(projectId);

  return (
    <DashboardView title="Settings" error={null}>
      <h2 style={heading}>CLI tokens — {current.name}</h2>
      <TokenManager
        projectId={projectId}
        initialTokens={tokens}
        canManage={current.role === 'owner' && !forbidden}
      />
    </DashboardView>
  );
}

const heading: CSSProperties = { margin: '0 0 0.5rem', fontSize: '1.05rem' };
const muted: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-muted, #52525b)',
  fontSize: '0.9rem',
};
