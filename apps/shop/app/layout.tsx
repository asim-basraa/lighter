import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import '@lighter/design-system/styles.css';
import './globals.css';
import { Providers } from './providers.js';
import { ShopChrome } from '../components/ShopChrome.js';

export const metadata: Metadata = {
  title: 'Aurora — Shop',
  description: 'A storefront built on the Lighter design system, from specs approved in Lighter.',
};

/**
 * Root layout: design-system theme + the shop's own chrome. Page bodies are Lighter specs exported
 * from the studio (see `specs/` and `lib/renderSpec`).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <ShopChrome>{children}</ShopChrome>
        </Providers>
      </body>
    </html>
  );
}
