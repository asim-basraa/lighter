import type { CSSProperties, ReactNode } from 'react';
import type { InventoryToken } from '../lib/inventory.js';
import { groupTokensByCategory } from '../lib/tokenGroups.js';

/** Friendly section headings for the foundational categories; others fall back to the raw name. */
const CATEGORY_LABEL: Record<string, string> = {
  color: 'Color',
  fontSize: 'Type scale',
  space: 'Spacing',
  radius: 'Radii',
  shadow: 'Shadows',
};

/**
 * The token inventory: every ingested token grouped by category and rendered VISUALLY — color chips,
 * a live type scale, spacing bars, radius and shadow boxes — so a maintainer sees the design system's
 * foundations, not just a list of values. Values come straight from the inventory API.
 */
export function TokenInventory({ tokens }: { tokens: InventoryToken[] }) {
  const groups = groupTokensByCategory(tokens);
  if (groups.length === 0) {
    return <p style={muted}>No tokens ingested yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      {groups.map(({ category, tokens: catTokens }) => (
        <section key={category} data-category={category}>
          <h2 style={sectionTitle}>{CATEGORY_LABEL[category] ?? category}</h2>
          <ul style={grid}>
            {catTokens.map((token) => (
              <li key={token.name} style={cell}>
                <TokenSwatch token={token} />
                <div style={meta}>
                  <code style={name}>{token.name}</code>
                  <span style={value}>{token.value}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The category-appropriate visual for a single token. */
function TokenSwatch({ token }: { token: InventoryToken }) {
  const testId = `swatch-${token.name}`;
  const base: CSSProperties = {
    width: '100%',
    height: 48,
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-neutral-300)',
  };

  switch (token.category) {
    case 'color':
      return <div data-testid={testId} style={{ ...base, background: token.value }} />;
    case 'fontSize':
      return (
        <div data-testid={testId} style={{ ...swatchBox, fontSize: token.value, lineHeight: 1 }}>
          Ag
        </div>
      );
    case 'space':
      return (
        <Frame>
          <div
            data-testid={testId}
            style={{ width: token.value, height: 12, background: 'var(--color-blue-500)' }}
          />
        </Frame>
      );
    case 'radius':
      return (
        <div
          data-testid={testId}
          style={{ ...base, borderRadius: token.value, background: 'var(--color-neutral-100)' }}
        />
      );
    case 'shadow':
      return (
        <Frame>
          <div
            data-testid={testId}
            style={{
              width: 48,
              height: 32,
              background: 'var(--color-neutral-50)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: token.value,
            }}
          />
        </Frame>
      );
    default:
      return (
        <div data-testid={testId} style={swatchBox}>
          {token.value}
        </div>
      );
  }
}

/** A neutral framing box so a small visual (spacing bar, shadow box) has room to breathe. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--space-2)',
        background: 'var(--color-neutral-100)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

const grid: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: 'var(--space-4)',
};

const cell: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' };

const swatchBox: CSSProperties = {
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-neutral-100)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-neutral-900)',
  overflow: 'hidden',
};

const sectionTitle: CSSProperties = {
  margin: '0 0 var(--space-4) 0',
  fontSize: 'var(--fontSize-lg)',
  color: 'var(--color-neutral-900)',
};

const meta: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2 };
const name: CSSProperties = { fontSize: 'var(--fontSize-sm)', color: 'var(--color-neutral-900)' };
const value: CSSProperties = { fontSize: 'var(--fontSize-xs)', color: 'var(--color-neutral-700)' };
const muted: CSSProperties = { margin: 0, color: 'var(--color-neutral-700)' };
