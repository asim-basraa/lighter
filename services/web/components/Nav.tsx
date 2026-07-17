import type { CSSProperties } from 'react';
import Link from 'next/link';

/** The dashboard's top navigation. Each entry is a view over the same ingested inventory. */
const LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Components' },
  { href: '/tokens', label: 'Tokens' },
  { href: '/health', label: 'Health' },
];

export function Nav() {
  return (
    <nav style={nav} aria-label="Dashboard sections">
      <span style={brand}>Lighter</span>
      <ul style={list}>
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} style={anchor}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const nav: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-6)',
  padding: 'var(--space-4) var(--space-6)',
  background: 'var(--color-neutral-50)',
  borderBottom: '1px solid var(--color-neutral-300)',
};

const brand: CSSProperties = {
  fontSize: 'var(--fontSize-lg)',
  fontWeight: 700,
  color: 'var(--color-neutral-900)',
};

const list: CSSProperties = {
  listStyle: 'none',
  display: 'flex',
  gap: 'var(--space-4)',
  margin: 0,
  padding: 0,
};

const anchor: CSSProperties = { color: 'var(--color-blue-700)', textDecoration: 'none' };
