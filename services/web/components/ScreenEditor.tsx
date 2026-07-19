'use client';

import { useState, type CSSProperties } from 'react';

/** A catalog/structural validation issue as the API returns it on a rejected save. */
interface Issue {
  code?: string;
  path?: string;
  message?: string;
}

/**
 * The amend → deploy → review loop for one screen (#156). Editing a spec never mutates a version:
 * saving creates the NEXT immutable version, and an invalid spec is rejected with the catalog issues
 * (exactly what the API does) so nothing is written. Deploy mints the tokenized review link; approve
 * / request-changes drive the per-version state machine.
 *
 * Every call goes through the same-origin `/api/screens/**` proxy, which attaches the session JWT
 * server-side — the browser never holds it.
 */
export function ScreenEditor({
  screenId,
  version,
  initialSpec,
  state,
}: {
  screenId: string;
  version: number;
  initialSpec: unknown;
  state: string;
}) {
  const [text, setText] = useState(() => JSON.stringify(initialSpec, null, 2));
  const [issues, setIssues] = useState<Issue[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const base = `/api/screens/${encodeURIComponent(screenId)}`;

  function reset() {
    setIssues([]);
    setMessage(null);
    setError(null);
  }

  async function call(path: string, body?: unknown) {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    return {
      ok: res.ok,
      status: res.status,
      body: (await res.json().catch(() => ({}))) as Record<string, unknown>,
    };
  }

  /** Save the edited spec as the next version — validated against the catalog server-side. */
  async function save() {
    reset();
    setPending('save');
    let spec: unknown;
    try {
      spec = JSON.parse(text);
    } catch (e) {
      setPending(null);
      setError(`That isn't valid JSON: ${(e as Error).message}`);
      return;
    }
    const { ok, body } = await call('/versions', { spec });
    setPending(null);
    if (!ok) {
      setError(String(body.message ?? 'the spec was rejected'));
      setIssues(Array.isArray(body.issues) ? (body.issues as Issue[]) : []);
      return;
    }
    setMessage(`Saved as version ${body.version}. Reload to edit it.`);
  }

  /** Deploy this version to a tokenized, account-free review link. */
  async function deploy() {
    reset();
    setPending('deploy');
    const { ok, body } = await call(`/versions/${version}/share`, {});
    setPending(null);
    if (!ok) return setError(String(body.message ?? 'could not deploy'));
    setShareUrl(`${window.location.origin}/share/${String(body.token)}`);
  }

  /** Drive the approval state machine (approve is gated by the sign-off set when configured). */
  async function transition(action: 'approve' | 'request-changes') {
    reset();
    setPending(action);
    const { ok, body } = await call(`/versions/${version}/${action}`, {});
    setPending(null);
    if (!ok) {
      const missing = Array.isArray(body.missing)
        ? ` — awaiting: ${(body.missing as string[]).join(', ')}`
        : '';
      return setError(`${String(body.message ?? action + ' failed')}${missing}`);
    }
    setMessage(`Version ${version} is now “${String(body.state)}”. Reload to refresh.`);
  }

  return (
    <div style={wrap}>
      <div style={toolbar}>
        <button onClick={save} disabled={pending !== null} style={primary}>
          {pending === 'save' ? 'Saving…' : 'Save as new version'}
        </button>
        <button onClick={deploy} disabled={pending !== null} style={secondary}>
          {pending === 'deploy' ? 'Deploying…' : 'Deploy review link'}
        </button>
        <button
          onClick={() => transition('request-changes')}
          disabled={pending !== null}
          style={secondary}
        >
          Request changes
        </button>
        <button onClick={() => transition('approve')} disabled={pending !== null} style={secondary}>
          Approve
        </button>
        <span style={muted}>
          v{version} · {state}
        </span>
      </div>

      {message && (
        <p role="status" style={okBox}>
          {message}
        </p>
      )}
      {shareUrl && (
        <p role="status" style={okBox}>
          Review link:{' '}
          <a href={shareUrl} target="_blank" rel="noreferrer" style={link}>
            {shareUrl}
          </a>
        </p>
      )}
      {error && (
        <div role="alert" style={errBox}>
          <strong>{error}</strong>
          {issues.length > 0 && (
            <ul style={issueList}>
              {issues.map((i, n) => (
                <li key={n}>
                  <code>{i.path ?? i.code}</code> — {i.message ?? i.code}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label style={muted} htmlFor="spec">
        Spec (JSON) — saving creates the next version; the current one is immutable
      </label>
      <textarea
        id="spec"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        style={editor}
      />
    </div>
  );
}

const wrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' };
const toolbar: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-2)',
  alignItems: 'center',
  flexWrap: 'wrap',
};
const primary: CSSProperties = {
  padding: '0.45rem 0.9rem',
  borderRadius: 8,
  border: 'none',
  background: 'var(--primary-default, #2563eb)',
  color: 'white',
  cursor: 'pointer',
};
const secondary: CSSProperties = {
  padding: '0.45rem 0.9rem',
  borderRadius: 8,
  border: '1px solid var(--border-strong, #cbd5e1)',
  background: 'transparent',
  cursor: 'pointer',
};
const editor: CSSProperties = {
  width: '100%',
  minHeight: 380,
  fontFamily: 'var(--fontFamily-mono, monospace)',
  fontSize: '0.82rem',
  padding: 'var(--space-3)',
  borderRadius: 8,
  border: '1px solid var(--border-default, #e2e8f0)',
};
const okBox: CSSProperties = {
  margin: 0,
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 8,
  background: 'var(--primary-subtle, #eff6ff)',
  color: 'var(--primary-default, #1d4ed8)',
  fontSize: 'var(--fontSize-sm)',
};
const errBox: CSSProperties = {
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 8,
  background: 'var(--destructive-subtle, #fef2f2)',
  color: 'var(--destructive-default, #b91c1c)',
  fontSize: 'var(--fontSize-sm)',
};
const issueList: CSSProperties = { margin: '0.4rem 0 0', paddingLeft: '1.1rem' };
const link: CSSProperties = { color: 'var(--primary-default, #2563eb)' };
const muted: CSSProperties = {
  color: 'var(--foreground-muted, #64748b)',
  fontSize: 'var(--fontSize-sm)',
};
