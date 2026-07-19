import type { CSSProperties, ReactNode } from 'react';

/**
 * The example design system's React components. Styling references the design tokens as CSS custom
 * properties (see `dist/tokens.css`), so the visual system stays in sync with the token source.
 * These are plain presentational components; `registry.tsx` binds them to the json-render catalog.
 */

export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export type ButtonVariant = 'primary' | 'secondary';
export type StackDirection = 'vertical' | 'horizontal';
export type SpaceStep = '1' | '2' | '4' | '6' | '8';

export function Text({ content, size = 'md' }: { content: string; size?: TextSize | null }) {
  const style: CSSProperties = {
    fontSize: `var(--fontSize-${size ?? 'md'})`,
    color: 'var(--color-neutral-900)',
    margin: 0,
  };
  return <p style={style}>{content}</p>;
}

export function Button({
  label,
  variant = 'primary',
}: {
  label: string;
  variant?: ButtonVariant | null;
}) {
  const palette: CSSProperties =
    variant === 'secondary'
      ? { background: 'var(--color-neutral-100)', color: 'var(--color-neutral-900)' }
      : { background: 'var(--color-blue-500)', color: 'var(--color-neutral-50)' };
  const style: CSSProperties = {
    ...palette,
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-2) var(--space-4)',
    fontSize: 'var(--fontSize-md)',
    cursor: 'pointer',
  };
  return (
    <button type="button" style={style}>
      {label}
    </button>
  );
}

export function Card({ title, children }: { title?: string | null; children?: ReactNode }) {
  const style: CSSProperties = {
    background: 'var(--color-neutral-50)',
    border: `1px solid var(--color-neutral-100)`,
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    padding: 'var(--space-4)',
  };
  return (
    <section style={style}>
      {title ? (
        <h3 style={{ margin: 0, marginBottom: 'var(--space-2)', fontSize: 'var(--fontSize-lg)' }}>
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

export function Stack({
  direction = 'vertical',
  gap = '4',
  children,
}: {
  direction?: StackDirection | null;
  gap?: SpaceStep | null;
  children?: ReactNode;
}) {
  const style: CSSProperties = {
    display: 'flex',
    flexDirection: direction === 'horizontal' ? 'row' : 'column',
    gap: `var(--space-${gap ?? '4'})`,
  };
  return <div style={style}>{children}</div>;
}

/**
 * The single layout-owning page shell. Generation is prompted to always start from a shell so mocks
 * stay structurally consistent; it renders a titled header above a main content region.
 */
export function PageShell({ title, children }: { title: string; children?: ReactNode }) {
  const shell: CSSProperties = {
    minHeight: '100%',
    background: 'var(--color-neutral-100)',
    fontFamily: 'system-ui, sans-serif',
  };
  const header: CSSProperties = {
    padding: 'var(--space-4) var(--space-6)',
    background: 'var(--color-neutral-50)',
    borderBottom: `1px solid var(--color-neutral-300)`,
  };
  const main: CSSProperties = { padding: 'var(--space-6)' };
  return (
    <div style={shell}>
      <header style={header}>
        <h1 style={{ margin: 0, fontSize: 'var(--fontSize-xl)' }}>{title}</h1>
      </header>
      <main style={main}>{children}</main>
    </div>
  );
}
