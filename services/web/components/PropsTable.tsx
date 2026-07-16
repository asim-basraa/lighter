import type { CSSProperties } from 'react';
import { propsToRows } from '../lib/propsSchema.js';

/**
 * A component's props, rendered as a table generated from its JSON Schema (name, type, required,
 * default) — not hand-authored, so it always matches the ingested contract. Presentational and
 * free of client-only APIs, so it renders on server or client.
 */
export function PropsTable({ props }: { props: unknown }) {
  const rows = propsToRows(props);
  if (rows.length === 0) {
    return <p style={muted}>No props.</p>;
  }

  return (
    <table style={table}>
      <thead>
        <tr>
          <th style={th} scope="col">
            Prop
          </th>
          <th style={th} scope="col">
            Type
          </th>
          <th style={th} scope="col">
            Required
          </th>
          <th style={th} scope="col">
            Default
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td style={td}>
              <code>{row.name}</code>
            </td>
            <td style={td}>
              <code>{row.type}</code>
            </td>
            <td style={td}>{row.required ? 'Yes' : 'No'}</td>
            <td style={td}>{row.default === null ? '—' : <code>{row.default}</code>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--fontSize-sm)',
  color: 'var(--color-neutral-900)',
};

const th: CSSProperties = {
  textAlign: 'left',
  padding: 'var(--space-1) var(--space-2)',
  borderBottom: '1px solid var(--color-neutral-300)',
  color: 'var(--color-neutral-700)',
  fontWeight: 600,
};

const td: CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  borderBottom: '1px solid var(--color-neutral-100)',
  verticalAlign: 'top',
};

const muted: CSSProperties = {
  margin: 0,
  fontSize: 'var(--fontSize-sm)',
  color: 'var(--color-neutral-700)',
};
