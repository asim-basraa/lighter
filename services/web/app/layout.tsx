import type { ReactNode } from 'react';
import type { Metadata } from 'next';
// The design system's token custom properties, so previews and chrome share one visual source.
import 'lighter-example/dist/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lighter — inventory dashboard',
  description: 'Live inventory of the design system: components, tokens, and health.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
