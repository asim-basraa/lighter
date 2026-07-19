import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { Nav } from '../../components/Nav.js';
import { AuthBar } from '../../components/AuthBar.js';
import { authEnabled } from '../../lib/supabase/env.js';
import { currentUser, selectedProjectId } from '../../lib/session.js';
import { listMyProjects } from '../../lib/projects.js';

/**
 * Chrome for the internal inventory dashboard: the top `<Nav>` above each view, and — when Supabase
 * Auth is configured — an `<AuthBar>` showing the current project + user with sign-out. Lives in a
 * route group so the public share surface (`/share/[token]`), which sits directly on the root layout,
 * does not inherit any of this — external reviewers see only the mock.
 *
 * Auth guard: the middleware guarantees a signed-in user here; this layer additionally requires a
 * SELECTED project (redirect to the chooser otherwise), so the scoped fetchers always have a project.
 * When Supabase is not configured the layout is unchanged (pre-auth behavior).
 */
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (!authEnabled()) {
    return (
      <>
        <Nav />
        {children}
      </>
    );
  }

  const [user, projects] = await Promise.all([currentUser(), listMyProjects()]);
  if (!user) redirect('/login');
  const selected = selectedProjectId();
  const current = projects.find((p) => p.id === selected);
  if (!current) redirect('/projects');

  return (
    <>
      <AuthBar projectName={current.name} role={current.role} email={user.email} />
      <Nav />
      {children}
    </>
  );
}
