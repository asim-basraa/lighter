'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { themeStylesheet } from '../tokens/index.js';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** The chosen mode (may be `system`). */
  theme: ThemeMode;
  /** The actual applied theme after resolving `system`. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  /** Convenience toggle between light and dark. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Injects the design system's token stylesheet and manages light/dark. Wrap your app once. Tokens are
 * emitted as CSS custom properties on `:root` (light) with dark overrides under
 * `:root[data-theme="dark"]` — so switching themes is a single attribute flip, no re-render of styles.
 * SSR-safe: the stylesheet is rendered inline; the resolved theme is applied to `<html>` on mount.
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: ReactNode;
  defaultTheme?: ThemeMode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    defaultTheme === 'dark' ? 'dark' : 'light',
  );

  const css = useMemo(() => themeStylesheet(), []);

  useEffect(() => {
    const resolved = theme === 'system' ? systemTheme() : theme;
    setResolvedTheme(resolved);
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  }, [theme]);

  // Track OS preference changes while in `system` mode.
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolvedTheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const toggle = useCallback(
    () =>
      setThemeState((t) =>
        t === 'dark' || (t === 'system' && systemTheme() === 'dark') ? 'light' : 'dark',
      ),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, toggle }),
    [theme, resolvedTheme, setTheme, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>
      <style data-lighter-tokens dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </ThemeContext.Provider>
  );
}

/** Access + control the current theme. Throws if used outside a `ThemeProvider`. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>');
  return ctx;
}
