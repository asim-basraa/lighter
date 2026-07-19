import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { tokenRootCss } from '../lib/tokenCss.js';
import { supabaseEnv } from '../lib/supabase/env.js';
import '@lighter/design-system/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lighter',
  description: 'Live inventory of the design system: components, tokens, and health.',
};

/**
 * The root layout: just the document shell and the design-system token custom properties. Navigation
 * chrome lives in the `(dashboard)` route group's layout, not here, so public surfaces (the `/share`
 * review pages) render on this bare shell without internal navigation.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  // Supabase config is read server-side (runtime env) and injected for the browser client (#144), so
  // the client never depends on build-time NEXT_PUBLIC inlining. The anon key is public-by-design.
  const sb = supabaseEnv();
  return (
    <html lang="en">
      <head>
        {/* The design system's token custom properties, so previews and chrome share one visual
            source. Derived from the shared tokens object (see lib/tokenCss), not a build artifact. */}
        <style dangerouslySetInnerHTML={{ __html: tokenRootCss() }} />
        {sb && (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__LIGHTER_SUPABASE__=${JSON.stringify(sb)}`,
            }}
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
