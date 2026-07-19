'use client';

import { useState, type CSSProperties } from 'react';

/** Token metadata as the API returns it (never the raw token). */
export interface TokenInfo {
  id: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * Project CLI-token management (#147): list, mint, revoke. A minted token is shown ONCE — the API
 * stores only its hash — so the copy box is the single chance to save it. Requests go through the
 * same-origin proxy, which attaches the signed-in user's JWT server-side.
 */
export function TokenManager({
  projectId,
  initialTokens,
  canManage,
}: {
  projectId: string;
  initialTokens: TokenInfo[];
  canManage: boolean;
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [minted, setMinted] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const base = `/api/projects/${encodeURIComponent(projectId)}/tokens`;

  async function refresh() {
    const res = await fetch(base, { cache: 'no-store' });
    if (res.ok) setTokens((await res.json()) as TokenInfo[]);
  }

  async function mint() {
    setPending(true);
    setError(null);
    setMinted(null);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(label.trim() ? { label: label.trim() } : {}),
      });
      const body = (await res.json()) as { token?: string; message?: string };
      if (!res.ok) throw new Error(body.message ?? 'could not generate a token');
      setMinted(body.token ?? null);
      setLabel('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not generate a token');
    } finally {
      setPending(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      const res = await fetch(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? 'could not revoke');
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not revoke');
    }
  }

  if (!canManage) {
    return <p style={muted}>Only a project owner can manage CLI tokens.</p>;
  }

  return (
    <section style={wrap}>
      <p style={muted}>
        A CLI token lets <code>lighter</code> (and CI) push your design system and author screens
        for this project. It is shown once — store it somewhere safe.
      </p>

      <div style={row}>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. laptop, CI)"
          style={input}
          aria-label="Token label"
        />
        <button onClick={mint} disabled={pending} style={button}>
          {pending ? 'Generating…' : 'Generate CLI token'}
        </button>
      </div>

      {error && (
        <p role="alert" style={errorText}>
          {error}
        </p>
      )}

      {minted && (
        <div role="status" style={mintedBox}>
          <strong style={{ display: 'block', marginBottom: '0.35rem' }}>
            Copy this now — it won&apos;t be shown again:
          </strong>
          <code style={code}>{minted}</code>
        </div>
      )}

      <ul style={list}>
        {tokens.length === 0 && <li style={muted}>No tokens yet.</li>}
        {tokens.map((t) => (
          <li key={t.id} style={item}>
            <span>
              <strong>{t.label ?? 'unlabelled'}</strong>{' '}
              <span style={muted}>· created {t.createdAt}</span>
            </span>
            <button onClick={() => revoke(t.id)} style={revokeBtn}>
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const wrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  maxWidth: 640,
};
const row: CSSProperties = { display: 'flex', gap: '0.5rem' };
const input: CSSProperties = {
  flex: 1,
  padding: '0.5rem 0.7rem',
  borderRadius: 8,
  border: '1px solid var(--border-default, #d4d4d8)',
};
const button: CSSProperties = {
  padding: '0.5rem 0.9rem',
  borderRadius: 8,
  border: 'none',
  background: 'var(--primary-default, #2563eb)',
  color: 'white',
  cursor: 'pointer',
};
const mintedBox: CSSProperties = {
  padding: '0.75rem',
  borderRadius: 8,
  border: '1px solid var(--primary-default, #2563eb)',
  background: 'var(--primary-subtle, #eff6ff)',
};
const code: CSSProperties = {
  display: 'block',
  wordBreak: 'break-all',
  fontFamily: 'var(--fontFamily-mono, monospace)',
  fontSize: '0.85rem',
};
const list: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};
const item: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.5rem 0.7rem',
  border: '1px solid var(--border-default, #e4e4e7)',
  borderRadius: 8,
  fontSize: '0.9rem',
};
const revokeBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-strong, #d4d4d8)',
  borderRadius: 6,
  padding: '0.2rem 0.6rem',
  cursor: 'pointer',
  fontSize: '0.8rem',
};
const muted: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-muted, #52525b)',
  fontSize: '0.9rem',
};
const errorText: CSSProperties = {
  margin: 0,
  color: 'var(--destructive-default, #dc2626)',
  fontSize: '0.85rem',
};
