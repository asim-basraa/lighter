import type { CSSProperties } from 'react';
import type { InventoryComponent } from '../lib/inventory.js';
import { usageFor, type SpecRecord } from '../lib/usage.js';

/**
 * Component usage / blast-radius: for each component, the screens and spec versions that reference
 * it — so a maintainer can see what a change would affect before making it. A component no saved
 * spec references shows an explicit "not used" state rather than a blank.
 *
 * Saved specs come from `lib/specs`; until the spec model (#13–16) persists them, that source is
 * empty and every component reads as unused.
 */
export function UsageView({
  components,
  specs,
}: {
  components: InventoryComponent[];
  specs: SpecRecord[];
}) {
  if (components.length === 0) {
    return <p style={muted}>No components ingested yet.</p>;
  }

  return (
    <ul style={list}>
      {components.map((component) => {
        const refs = usageFor(specs, component.name);
        return (
          <li key={component.name} style={row} data-component={component.name}>
            <h3 style={name}>{component.name}</h3>
            {refs.length === 0 ? (
              <span style={muted}>Not used in any saved spec.</span>
            ) : (
              <ul style={refList}>
                {refs.map((ref) => (
                  <li key={`${ref.screen}@${ref.version}`} style={refPill}>
                    <strong>{ref.screen}</strong>
                    <span style={version}>{ref.version}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const list: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-4)',
  flexWrap: 'wrap',
  background: 'var(--color-neutral-50)',
  border: '1px solid var(--color-neutral-300)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-2) var(--space-4)',
};

const name: CSSProperties = {
  margin: 0,
  minWidth: 140,
  fontSize: 'var(--fontSize-md)',
  color: 'var(--color-neutral-900)',
};

const refList: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-2)',
};

const refPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: '2px var(--space-2)',
  borderRadius: 'var(--radius-full)',
  background: 'var(--color-blue-100)',
  color: 'var(--color-blue-700)',
  fontSize: 'var(--fontSize-xs)',
};

const version: CSSProperties = {
  padding: '0 6px',
  borderRadius: 'var(--radius-full)',
  background: 'var(--color-blue-500)',
  color: 'var(--color-neutral-50)',
};

const muted: CSSProperties = {
  margin: 0,
  fontSize: 'var(--fontSize-sm)',
  color: 'var(--color-neutral-700)',
};
