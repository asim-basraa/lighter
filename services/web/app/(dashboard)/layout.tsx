import type { ReactNode } from 'react';
import { Nav } from '../../components/Nav.js';

/**
 * Chrome for the internal inventory dashboard: the top `<Nav>` above each view. Lives in a route
 * group so the public share surface (`/share/[token]`), which sits directly on the root layout, does
 * not inherit the internal navigation — external reviewers see only the mock.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      {children}
    </>
  );
}
