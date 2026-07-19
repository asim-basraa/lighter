import type { ReactNode, CSSProperties } from 'react';
import Link from 'next/link';

/**
 * The shop's own chrome (#153): header, nav, cart indicator, footer. This is REAL app code — routing
 * and state belong to the product, not to a Lighter spec. The page bodies inside `{children}` are the
 * spec-rendered layouts exported from Lighter, so the boundary is explicit:
 *   app owns the shell + navigation · Lighter owns the screen content.
 */
const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Shop' },
  { href: '/product', label: 'Product' },
  { href: '/cart', label: 'Cart' },
  { href: '/checkout', label: 'Checkout' },
];

/** Items currently in the cart. Mirrors the exported cart spec (Slate Runner + Mist Tee). */
export const CART_COUNT = 2;

export function ShopChrome({ children }: { children: ReactNode }) {
  return (
    <div style={page}>
      <header style={header}>
        <Link href="/" style={brand}>
          ◆ Aurora
        </Link>
        <nav style={nav} aria-label="Shop">
          {NAV.map((l) => (
            <Link key={l.href} href={l.href} style={link}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/cart" style={cart} aria-label={`Cart, ${CART_COUNT} items`}>
          Cart <span style={badge}>{CART_COUNT}</span>
        </Link>
      </header>

      <main style={main}>{children}</main>

      <footer style={footer}>
        Built on <strong>@lighter/design-system</strong> · screens authored, reviewed and approved
        in Lighter, then exported into <code>specs/</code>
      </footer>
    </div>
  );
}

const page: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--background-canvas)',
  color: 'var(--foreground-default)',
};
const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--spacing-6)',
  padding: 'var(--spacing-4) var(--spacing-6)',
  borderBottom: '1px solid var(--border-default)',
  background: 'var(--background-subtle)',
};
const brand: CSSProperties = {
  fontWeight: 700,
  fontSize: 'var(--fontSize-lg)',
  color: 'var(--foreground-default)',
  textDecoration: 'none',
};
const nav: CSSProperties = { display: 'flex', gap: 'var(--spacing-4)', flex: 1 };
const link: CSSProperties = { color: 'var(--foreground-muted)', textDecoration: 'none' };
const cart: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--spacing-2)',
  color: 'var(--primary-default)',
  textDecoration: 'none',
  fontWeight: 600,
};
const badge: CSSProperties = {
  background: 'var(--primary-default)',
  color: 'var(--primary-foreground)',
  borderRadius: 999,
  padding: '0 0.45rem',
  fontSize: 'var(--fontSize-sm)',
};
const main: CSSProperties = { flex: 1 };
const footer: CSSProperties = {
  padding: 'var(--spacing-4) var(--spacing-6)',
  borderTop: '1px solid var(--border-default)',
  color: 'var(--foreground-muted)',
  fontSize: 'var(--fontSize-sm)',
};
