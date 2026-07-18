'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconButton, cx } from '@lighter/design-system';
import { useTheme } from '@lighter/design-system/theme';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/components', label: 'Components' },
  { href: '/render', label: 'Render a spec' },
  { href: '/dashboard', label: 'Dashboard' },
];

function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme();
  return (
    <IconButton aria-label="Toggle theme" variant="ghost" onClick={toggle}>
      {resolvedTheme === 'dark' ? '☀️' : '🌙'}
    </IconButton>
  );
}

/**
 * The app shell: a fixed sidebar + top bar + main content region — the page architecture a consumer
 * starts from. Add routes to `NAV` and drop pages in `app/`.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand">◆ Starter</div>
        <nav className="app-shell__nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx('app-shell__link', pathname === item.href && 'app-shell__link--active')}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="app-shell__foot">
          Built on <strong>@lighter/design-system</strong>
        </div>
      </aside>
      <div className="app-shell__body">
        <header className="app-shell__topbar">
          <span className="app-shell__topbar-title">Lighter Starter</span>
          <ThemeToggle />
        </header>
        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}
