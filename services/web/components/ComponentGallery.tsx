'use client';

import type { CSSProperties } from 'react';
import { SpecView, previews, type PreviewSpec } from 'lighter-example/ui';
import type { InventoryComponent } from '../lib/inventory.js';
import { PropsTable } from './PropsTable.js';

/**
 * The component gallery: one card per cataloged component, each rendering a LIVE preview of the real
 * component through lighter-example's `<SpecView>`. The component list comes from the inventory API
 * (see `lib/inventory`); the preview spec for a name comes from the design system's own `previews`
 * export. A component with no preview spec renders a note rather than an empty card.
 */
export function ComponentGallery({ components }: { components: InventoryComponent[] }) {
  if (components.length === 0) {
    return <p style={muted}>No components ingested yet.</p>;
  }

  return (
    <ul style={grid}>
      {components.map((component) => (
        <ComponentCard key={component.name} component={component} />
      ))}
    </ul>
  );
}

function ComponentCard({ component }: { component: InventoryComponent }) {
  const spec = previews[component.name] as PreviewSpec | undefined;
  return (
    <li style={card} data-component={component.name}>
      <h3 style={cardTitle}>{component.name}</h3>
      <p style={muted}>{component.description}</p>
      <div style={previewFrame}>
        {spec ? <SpecView spec={spec} /> : <p style={muted}>No preview available</p>}
      </div>
      <PropsTable props={component.props} />
    </li>
  );
}

const grid: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 'var(--space-4)',
};

const card: CSSProperties = {
  background: 'var(--color-neutral-50)',
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const cardTitle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--fontSize-lg)',
  color: 'var(--color-neutral-900)',
};

const muted: CSSProperties = {
  margin: 0,
  fontSize: 'var(--fontSize-sm)',
  color: 'var(--color-neutral-700)',
};

const previewFrame: CSSProperties = {
  marginTop: 'var(--space-2)',
  padding: 'var(--space-4)',
  background: 'var(--color-neutral-100)',
  borderRadius: 'var(--radius-md)',
};
