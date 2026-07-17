import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { tokenRootCss } from '../lib/tokenCss.js';
import { Nav } from '../components/Nav.js';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lighter — inventory dashboard',
  description: 'Live inventory of the design system: components, tokens, and health.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* The design system's token custom properties, so previews and chrome share one visual
            source. Derived from the shared tokens object (see lib/tokenCss), not a build artifact. */}
        <style dangerouslySetInnerHTML={{ __html: tokenRootCss() }} />
      </head>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
