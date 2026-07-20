'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import type { SpecNode } from '@lighter/spec';
import { controlsFor, coerce, display, type PropControl } from '../lib/propControls.js';

/**
 * The selected component's properties, generated from the catalog's JSON Schema (#166).
 *
 * Never hand-written: enums become selects, `required` becomes validation, numeric bounds become
 * input constraints. A component that gains a variant in the design system gains the control here
 * for free, and the panel can't drift from the real contract.
 *
 * Only *declared* props are editable. There is deliberately no arbitrary styling control — a
 * per-instance padding or colour would make specs stop being compositions of approved components,
 * which is the premise the whole system rests on.
 */
export function PropertyPanel({
  node,
  propsSchema,
  onChange,
}: {
  node: SpecNode;
  propsSchema: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  const controls = useMemo(() => controlsFor(propsSchema), [propsSchema]);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string | null>>({});

  if (controls.length === 0) {
    return (
      <p style={muted}>
        {propsSchema
          ? `${node.type} takes no props.`
          : `${node.type} isn’t in the ingested catalog, so its properties can’t be edited here.`}
      </p>
    );
  }

  const set = (control: PropControl, raw: string | boolean) => {
    const value = coerce(control, raw);
    if (control.kind === 'json' && typeof raw === 'string' && raw.trim() && value === undefined) {
      // Keep the previous value and say so, rather than wiping the prop on a half-typed edit.
      setJsonErrors((e) => ({ ...e, [control.name]: 'Not valid JSON yet' }));
      return;
    }
    setJsonErrors((e) => ({ ...e, [control.name]: null }));
    onChange(control.name, value);
  };

  return (
    <div>
      {controls.map((control) => {
        const value = node.props[control.name];
        const id = `prop-${control.name}`;
        return (
          <div key={control.name} style={field}>
            <label htmlFor={id} style={labelStyle}>
              {control.name}
              {control.required && <span style={req} title="Required"> *</span>}
            </label>

            {control.kind === 'boolean' ? (
              <input
                id={id}
                type="checkbox"
                checked={value === true}
                onChange={(e) => set(control, e.target.checked)}
              />
            ) : control.kind === 'enum' ? (
              <select
                id={id}
                value={display(value)}
                style={input}
                onChange={(e) => set(control, e.target.value)}
              >
                {control.options!.map((option) => (
                  <option key={option || '(unset)'} value={option}>
                    {option || '—'}
                  </option>
                ))}
              </select>
            ) : control.kind === 'number' ? (
              <input
                id={id}
                type="number"
                value={display(value)}
                min={control.min}
                max={control.max}
                style={input}
                onChange={(e) => set(control, e.target.value)}
              />
            ) : (
              <textarea
                id={id}
                value={display(value)}
                rows={control.kind === 'json' ? 4 : control.kind === 'textarea' ? 3 : 1}
                spellCheck={false}
                style={{ ...input, ...(control.kind === 'json' ? mono : null) }}
                onChange={(e) => set(control, e.target.value)}
              />
            )}

            {jsonErrors[control.name] && <p style={warn}>{jsonErrors[control.name]}</p>}
            {control.description && <p style={hint}>{control.description}</p>}
          </div>
        );
      })}
    </div>
  );
}

const field: CSSProperties = { marginBottom: 8 };
const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--foreground-muted, #64748b)',
  marginBottom: 2,
};
const req: CSSProperties = { color: 'var(--destructive-default, #dc2626)' };
const input: CSSProperties = {
  width: '100%',
  fontSize: 11,
  padding: '4px 6px',
  borderRadius: 6,
  border: '1px solid var(--border-default, #e2e8f0)',
  resize: 'vertical',
};
const mono: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, monospace' };
const muted: CSSProperties = {
  color: 'var(--foreground-muted, #64748b)',
  fontSize: 'var(--fontSize-xs)',
};
const hint: CSSProperties = { fontSize: 10, color: 'var(--foreground-muted, #64748b)', margin: '2px 0 0' };
const warn: CSSProperties = { fontSize: 10, color: '#92400e', margin: '2px 0 0' };
