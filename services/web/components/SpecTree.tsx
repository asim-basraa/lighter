'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { Spec } from '@lighter/spec';
import { walk, samePath, type Path } from '../lib/specEdit.js';

export interface CatalogEntry {
  name: string;
  slots: string[];
  description?: string;
}

/**
 * The screen's component tree (#166) — select, reorder, delete, and insert into valid slots.
 *
 * Insertion is offered only where the catalog says children are accepted (`slots`), so an invalid
 * tree can't be built and then rejected on push. Preventing the mistake beats reporting it.
 */
export function SpecTree({
  spec,
  catalog,
  selected,
  onSelect,
  onInsert,
  onRemove,
  onMove,
}: {
  spec: Spec;
  catalog: CatalogEntry[];
  selected: Path | null;
  onSelect: (path: Path) => void;
  onInsert: (parent: Path, type: string) => void;
  onRemove: (path: Path) => void;
  onMove: (path: Path, delta: number) => void;
}) {
  const rows = useMemo(() => walk(spec), [spec]);
  const [insertAt, setInsertAt] = useState<Path | null>(null);

  const acceptsChildren = useMemo(() => {
    const byName = new Map(catalog.map((c) => [c.name, c]));
    return (type: string) => (byName.get(type)?.slots.length ?? 0) > 0;
  }, [catalog]);

  return (
    <div style={wrap}>
      {rows.map(({ node, path }) => {
        const isSelected = selected !== null && samePath(selected, path);
        const canInsert = acceptsChildren(node.type);
        const label = summarize(node.props);
        return (
          <div key={path.join('.') || 'root'}>
            <div
              style={{ ...row, paddingLeft: 4 + path.length * 12, ...(isSelected ? rowOn : null) }}
              onClick={() => onSelect(path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(path)}
              aria-current={isSelected}
            >
              <span style={typeName}>{node.type}</span>
              {label && <span style={muted}>{label}</span>}
              <span style={spacer} />
              {canInsert && (
                <button
                  type="button"
                  style={miniBtn}
                  title={`Add a component inside ${node.type}`}
                  aria-label={`Add inside ${node.type}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInsertAt(insertAt && samePath(insertAt, path) ? null : path);
                  }}
                >
                  +
                </button>
              )}
              {path.length > 0 && (
                <>
                  <button type="button" style={miniBtn} title="Move up" aria-label="Move up"
                    onClick={(e) => { e.stopPropagation(); onMove(path, -1); }}>↑</button>
                  <button type="button" style={miniBtn} title="Move down" aria-label="Move down"
                    onClick={(e) => { e.stopPropagation(); onMove(path, 1); }}>↓</button>
                  <button type="button" style={miniBtn} title="Delete" aria-label={`Delete ${node.type}`}
                    onClick={(e) => { e.stopPropagation(); onRemove(path); }}>×</button>
                </>
              )}
            </div>

            {insertAt && samePath(insertAt, path) && (
              <div style={{ ...picker, marginLeft: 4 + path.length * 12 }}>
                <select
                  defaultValue=""
                  aria-label={`Component to add inside ${node.type}`}
                  style={pickerSelect}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onInsert(path, e.target.value);
                    setInsertAt(null);
                  }}
                >
                  <option value="">Add a component…</option>
                  {catalog.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The most identifying prop, so a row reads as the thing it renders rather than just its type. */
function summarize(props: Record<string, unknown>): string {
  for (const key of ['label', 'content', 'title', 'name', 'src', 'message']) {
    const value = props[key];
    if (typeof value === 'string' && value.trim()) {
      return value.length > 24 ? `${value.slice(0, 24)}…` : value;
    }
  }
  return '';
}

const wrap: CSSProperties = {
  border: '1px solid var(--border-default, #e2e8f0)',
  borderRadius: 6,
  maxHeight: 260,
  overflowY: 'auto',
  background: 'var(--background-canvas, #fff)',
};
const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 6px',
  cursor: 'pointer',
  fontSize: 11,
  borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
};
const rowOn: CSSProperties = {
  background: 'var(--primary-subtle, #eff6ff)',
  boxShadow: 'inset 2px 0 0 var(--primary-default, #2563eb)',
};
const typeName: CSSProperties = { fontWeight: 600 };
const muted: CSSProperties = {
  color: 'var(--foreground-muted, #64748b)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const spacer: CSSProperties = { flex: 1 };
const miniBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--foreground-muted, #64748b)',
  fontSize: 12,
  lineHeight: 1,
  padding: '0 2px',
};
const picker: CSSProperties = { padding: '4px 6px' };
const pickerSelect: CSSProperties = {
  width: '100%',
  fontSize: 11,
  padding: '3px 4px',
  borderRadius: 6,
  border: '1px solid var(--border-default, #e2e8f0)',
};
