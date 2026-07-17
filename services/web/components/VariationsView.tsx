'use client';

import type { CSSProperties } from 'react';
import { SpecView, type PreviewSpec } from 'lighter-example/ui';
import { toJsonRender } from '@lighter/spec/render';
import type { Spec } from '@lighter/spec';

/**
 * Render several generated spec variations side by side, each as a live preview through
 * lighter-example's `<SpecView>`. Internal specs are converted to json-render form at the boundary
 * (see `@lighter/spec/render`); the browser bundle never pulls in the node-only catalog validator.
 */
export function VariationsView({ specs }: { specs: Spec[] }) {
  if (specs.length === 0) {
    return <p style={muted}>No variations generated.</p>;
  }

  return (
    <ol style={row}>
      {specs.map((spec, i) => (
        <li key={i} style={column} data-variation={i + 1}>
          <h3 style={label}>Variation {i + 1}</h3>
          <div style={frame}>
            <SpecView spec={toJsonRender(spec) as PreviewSpec} />
          </div>
        </li>
      ))}
    </ol>
  );
}

const row: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  gap: 'var(--space-4)',
  overflowX: 'auto',
  alignItems: 'flex-start',
};

const column: CSSProperties = {
  flex: '0 0 320px',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const label: CSSProperties = {
  margin: 0,
  fontSize: 'var(--fontSize-sm)',
  color: 'var(--color-neutral-700)',
};

const frame: CSSProperties = {
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
  background: 'var(--color-neutral-50)',
};

const muted: CSSProperties = { margin: 0, color: 'var(--color-neutral-700)' };
