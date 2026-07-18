'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from '@lighter/design-system/theme';

/** Wraps the app in the design system's ThemeProvider (light/dark/system + token injection). */
export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider defaultTheme="system">{children}</ThemeProvider>;
}
