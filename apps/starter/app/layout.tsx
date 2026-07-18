import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import '@lighter/design-system/styles.css';
import './globals.css';
import { Providers } from './providers.js';
import { AppShell } from '../components/AppShell.js';

export const metadata: Metadata = {
  title: 'Lighter Starter',
  description: 'A Next.js + json-render starter on the Lighter design system.',
};

/**
 * Root layout. The page architecture (theme, shell, nav) is wired here — a consumer starts building
 * by editing pages under `app/` and components in the design system. Theme + tokens come from
 * `<Providers>` (design system ThemeProvider); styles from `@lighter/design-system/styles.css`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
