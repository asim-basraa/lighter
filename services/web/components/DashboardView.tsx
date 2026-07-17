import type { CSSProperties, ReactNode } from 'react';

/**
 * The shared frame for a dashboard page: a titled `<main>` that renders its children, or — when the
 * inventory could not be loaded — a single error message instead. Keeps each page (components,
 * tokens, health, usage) down to "load inventory, pick a view".
 */
export function DashboardView({
  title,
  error,
  children,
}: {
  title: string;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <main style={main}>
      <h1 style={heading}>{title}</h1>
      {error ? (
        <p style={{ color: 'var(--color-red-700)' }}>Could not reach the inventory API: {error}</p>
      ) : (
        children
      )}
    </main>
  );
}

const main: CSSProperties = {
  padding: 'var(--space-6)',
  maxWidth: 1120,
  margin: '0 auto',
};

const heading: CSSProperties = {
  fontSize: 'var(--fontSize-2xl)',
  color: 'var(--color-neutral-900)',
  marginTop: 0,
};
