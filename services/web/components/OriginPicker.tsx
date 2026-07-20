'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { PreviewOrigin } from '../lib/originRules.js';

/**
 * Choose (and manage) which running app the studio frames (#166).
 *
 * Switching origin navigates rather than swapping the iframe `src` in place: the server re-checks
 * the allowlist on every load, so the permitted set is never decided by client state. Adding an
 * origin goes through the same-origin proxy, so the browser never holds the project credential.
 */
export function OriginPicker({
  current,
  allowed,
  screenId,
  version,
}: {
  current: string;
  allowed: PreviewOrigin[];
  screenId: string;
  version: number;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (origin: string) => {
    const q = new URLSearchParams({ v: String(version), origin });
    router.push(`/screens/${encodeURIComponent(screenId)}/live?${q}`);
  };

  // Loopback is always previewable but never stored, so it won't appear in `allowed` — offer the
  // current origin as an option regardless so the selected value is always representable.
  const options = allowed.some((o) => o.origin === current)
    ? allowed
    : [{ origin: current, label: 'this session', createdAt: '' }, ...allowed];

  async function add() {
    const origin = value.trim();
    if (!origin) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/preview-origins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ origin }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? 'Could not add that origin.');
        return;
      }
      setValue('');
      setAdding(false);
      go(origin);
    } catch {
      setError('Could not reach the API.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(origin: string) {
    setBusy(true);
    await fetch(`/api/preview-origins?origin=${encodeURIComponent(origin)}`, { method: 'DELETE' });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div style={row}>
        <select
          value={current}
          onChange={(e) => go(e.target.value)}
          style={select}
          aria-label="App origin to preview"
        >
          {options.map((o) => (
            <option key={o.origin} value={o.origin}>
              {o.origin}
              {o.label ? ` — ${o.label}` : ''}
            </option>
          ))}
        </select>
        <button type="button" style={iconBtn} onClick={() => setAdding((a) => !a)} title="Add an app origin">
          +
        </button>
      </div>

      {adding && (
        <div style={{ marginTop: 6 }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder="https://shop-preview.vercel.app"
            style={input}
            aria-label="New app origin"
            disabled={busy}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button type="button" style={smallBtn} onClick={() => void add()} disabled={busy}>
              Add
            </button>
            {allowed.some((o) => o.origin === current) && (
              <button type="button" style={smallBtn} onClick={() => void remove(current)} disabled={busy}>
                Remove current
              </button>
            )}
          </div>
          <p style={hint}>
            A bare origin — scheme, host and optional port, no path. Any <code>localhost</code> works
            without adding it.
          </p>
          {error && <p style={warn}>{error}</p>}
        </div>
      )}
    </div>
  );
}

const row: CSSProperties = { display: 'flex', gap: 4 };
const select: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 11,
  padding: '3px 4px',
  borderRadius: 6,
  border: '1px solid var(--border-default, #e2e8f0)',
};
const iconBtn: CSSProperties = {
  width: 24,
  borderRadius: 6,
  border: '1px solid var(--border-default, #e2e8f0)',
  background: 'transparent',
  cursor: 'pointer',
};
const input: CSSProperties = {
  width: '100%',
  fontSize: 11,
  padding: '4px 6px',
  borderRadius: 6,
  border: '1px solid var(--border-default, #e2e8f0)',
};
const smallBtn: CSSProperties = {
  padding: '3px 8px',
  borderRadius: 6,
  border: '1px solid var(--border-default, #e2e8f0)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 11,
};
const hint: CSSProperties = {
  fontSize: 10,
  color: 'var(--foreground-muted, #64748b)',
  margin: '4px 0 0',
};
const warn: CSSProperties = {
  fontSize: 11,
  color: '#92400e',
  background: 'var(--warning-subtle, #fffbeb)',
  padding: '4px 6px',
  borderRadius: 6,
  margin: '4px 0 0',
};
