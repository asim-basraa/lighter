'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  PROTOCOL_VERSION,
  asFrameMessage,
  isCompatible,
  type ParentMessage,
} from '@lighter/preview';
import type { Spec } from '@lighter/spec';
import { buildTokenCss, DEFAULT_EDITS, type TokenEdits } from '../lib/tokenOverrides.js';
import { OriginPicker } from './OriginPicker.js';
import type { PreviewOrigin } from '../lib/previewOrigins.js';

/**
 * Drive a real running app from the studio (#166/#169/#171).
 *
 * The iframe is the consumer app itself — its own routing, its own APIs, its own state. Lighter
 * pushes spec and token edits over `postMessage`; the app applies them in place. Nothing reloads, so
 * a cart stays full and a scroll position holds while you retune the design.
 *
 * Connection state is shown honestly. An app without the SDK, or on an incompatible protocol, says so
 * rather than presenting an inert rectangle the user has to debug from the console.
 */
export function LivePreview({
  screenId,
  versions,
  initialVersion,
  initialSpec,
  origin,
  allowedOrigins,
  mixedContentBlocked,
}: {
  screenId: string;
  versions: number[];
  initialVersion: number;
  initialSpec: Spec;
  origin: string;
  allowedOrigins: PreviewOrigin[];
  mixedContentBlocked: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [connection, setConnection] = useState<'waiting' | 'connected' | 'incompatible'>('waiting');
  const [sdkVersion, setSdkVersion] = useState<string | null>(null);
  const [appPath, setAppPath] = useState<string | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);

  const [specText, setSpecText] = useState(() => JSON.stringify(initialSpec, null, 2));
  const [specError, setSpecError] = useState<string | null>(null);
  const [edits, setEdits] = useState<TokenEdits>(DEFAULT_EDITS);
  const [live, setLive] = useState(true);

  const post = useCallback(
    (message: ParentMessage) => {
      frame.current?.contentWindow?.postMessage(message, origin);
    },
    [origin],
  );

  // Parent half of the handshake.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const message = asFrameMessage(event.data);
      if (!message) return;

      if (message.type === 'lighter:hello') {
        setSdkVersion(message.sdkVersion);
        setAppPath(message.path);
        if (!isCompatible(message.protocol)) {
          setConnection('incompatible');
          return;
        }
        setConnection('connected');
        post({ type: 'lighter:ready', protocol: PROTOCOL_VERSION });
      } else if (message.type === 'lighter:navigated') {
        setAppPath(message.path);
      } else if (message.type === 'lighter:error') {
        setFrameError(message.message);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [origin, post]);

  const tokenCss = useMemo(() => buildTokenCss(edits), [edits]);

  // Token edits stream continuously — they're a stylesheet swap, so they're cheap enough to send on
  // every change without debouncing.
  useEffect(() => {
    if (connection !== 'connected') return;
    post({ type: 'lighter:tokens', css: tokenCss });
  }, [tokenCss, connection, post]);

  const applySpec = useCallback(
    (text: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        setSpecError(error instanceof Error ? error.message : 'Invalid JSON');
        return;
      }
      setSpecError(null);
      setFrameError(null);
      post({ type: 'lighter:spec', screenId, version: null, spec: parsed });
    },
    [post, screenId],
  );

  // Live mode: apply as you type. Debounced, because a spec swap re-renders the tree — unlike tokens.
  useEffect(() => {
    if (!live || connection !== 'connected') return;
    const id = setTimeout(() => applySpec(specText), 300);
    return () => clearTimeout(id);
  }, [specText, live, connection, applySpec]);

  const loadVersion = useCallback(
    async (version: number) => {
      const res = await fetch(`/api/screens/${encodeURIComponent(screenId)}/versions/${version}`);
      if (!res.ok) {
        setSpecError(`Could not load v${version}.`);
        return;
      }
      const body = (await res.json()) as { spec: Spec };
      setSpecText(JSON.stringify(body.spec, null, 2));
    },
    [screenId],
  );

  return (
    <div style={shell}>
      <aside style={rail}>
        <header style={railHead}>
          <strong>{screenId}</strong>
          <ConnectionPill state={connection} sdkVersion={sdkVersion} />
        </header>

        {mixedContentBlocked && (
          <p style={warn}>
            This studio is served over HTTPS and can’t frame <code>{origin}</code> — browsers block
            mixed content. Run the studio locally to preview a local app.
          </p>
        )}
        {connection === 'incompatible' && (
          <p style={warn}>
            The app speaks a different preview protocol than this studio (v{PROTOCOL_VERSION}).
            Update <code>@lighter/preview</code> in the app.
          </p>
        )}
        {connection === 'waiting' && !mixedContentBlocked && (
          <p style={muted}>
            Waiting for the app to announce itself. If nothing happens, it isn’t running{' '}
            <code>@lighter/preview</code>, or this studio’s origin isn’t in its allowlist.
          </p>
        )}
        {frameError && <p style={warn}>{frameError}</p>}

        <section style={group}>
          <h2 style={groupTitle}>Tokens</h2>
          <Color label="Brand" value={edits.primary ?? '#2563eb'} onChange={(primary) => setEdits((e) => ({ ...e, primary }))} />
          <Color label="Background" value={edits.background ?? '#ffffff'} onChange={(background) => setEdits((e) => ({ ...e, background }))} />
          <Color label="Text" value={edits.foreground ?? '#0f172a'} onChange={(foreground) => setEdits((e) => ({ ...e, foreground }))} />
          <Range label="Density" value={edits.spaceScale ?? 1} onChange={(spaceScale) => setEdits((e) => ({ ...e, spaceScale }))} />
          <Range label="Type scale" value={edits.fontScale ?? 1} onChange={(fontScale) => setEdits((e) => ({ ...e, fontScale }))} />
          <Range label="Radius" value={edits.radiusScale ?? 1} min={0} max={3} onChange={(radiusScale) => setEdits((e) => ({ ...e, radiusScale }))} />
          <button type="button" style={ghostBtn} onClick={() => setEdits(DEFAULT_EDITS)}>
            Reset tokens
          </button>
        </section>

        <section style={group}>
          <h2 style={groupTitle}>Spec</h2>
          <div style={versionRow}>
            {versions.map((v) => (
              <button
                key={v}
                type="button"
                style={v === initialVersion ? versionOn : versionOff}
                onClick={() => void loadVersion(v)}
              >
                v{v}
              </button>
            ))}
          </div>
          <label style={checkRow}>
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Apply as I type
          </label>
          <textarea
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            spellCheck={false}
            style={editor}
            aria-label="Screen spec JSON"
          />
          {specError && <p style={warn}>{specError}</p>}
          {!live && (
            <button type="button" style={primaryBtn} onClick={() => applySpec(specText)}>
              Apply spec
            </button>
          )}
        </section>

        <section style={group}>
          <h2 style={groupTitle}>App</h2>
          <OriginPicker
            current={origin}
            allowed={allowedOrigins}
            screenId={screenId}
            version={initialVersion}
          />
          {appPath && <p style={muted}>at <code>{appPath}</code></p>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={ghostBtn} onClick={() => post({ type: 'lighter:refresh' })}>
              Refresh data
            </button>
            <button type="button" style={ghostBtn} onClick={() => post({ type: 'lighter:refresh', hard: true })}>
              Hard reload
            </button>
          </div>
        </section>
      </aside>

      <div style={stage}>
        <iframe
          ref={frame}
          src={origin}
          title={`Live preview of ${screenId}`}
          style={iframeStyle}
          // The previewed app is first-party-ish but still separate: allow it to run and navigate,
          // not to break out of the frame or trigger downloads.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}

function ConnectionPill({ state, sdkVersion }: { state: string; sdkVersion: string | null }) {
  const tone =
    state === 'connected' ? '#16a34a' : state === 'incompatible' ? '#dc2626' : '#94a3b8';
  const label =
    state === 'connected' ? `connected${sdkVersion ? ` · sdk ${sdkVersion}` : ''}`
    : state === 'incompatible' ? 'incompatible'
    : 'waiting';
  return (
    <span style={{ ...pill, color: tone }} role="status">
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: tone }} />
      {label}
    </span>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={fieldRow}>
      <span>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={colorInput} />
    </label>
  );
}

function Range({
  label,
  value,
  onChange,
  min = 0.5,
  max = 2,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label style={fieldRow}>
      <span>
        {label} <span style={muted}>{value.toFixed(2)}×</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

const shell: CSSProperties = { display: 'flex', height: '100vh', overflow: 'hidden' };
const rail: CSSProperties = {
  width: 320,
  flexShrink: 0,
  borderRight: '1px solid var(--border-default, #e2e8f0)',
  padding: 'var(--space-4)',
  overflowY: 'auto',
  background: 'var(--background-subtle, #f8fafc)',
  fontSize: 'var(--fontSize-sm)',
};
const railHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 'var(--space-3)',
};
const stage: CSSProperties = { flex: 1, minWidth: 0, background: '#fff' };
const iframeStyle: CSSProperties = { width: '100%', height: '100%', border: 0, display: 'block' };
const group: CSSProperties = { marginTop: 'var(--space-4)' };
const groupTitle: CSSProperties = {
  fontSize: 'var(--fontSize-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--foreground-muted, #64748b)',
  margin: '0 0 var(--space-2)',
};
const fieldRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  margin: '6px 0',
};
const colorInput: CSSProperties = { width: 40, height: 24, padding: 0, border: 0, background: 'none' };
const editor: CSSProperties = {
  width: '100%',
  height: 240,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: 11,
  lineHeight: 1.5,
  padding: 8,
  borderRadius: 6,
  border: '1px solid var(--border-default, #e2e8f0)',
  resize: 'vertical',
};
const checkRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, margin: '6px 0' };
const versionRow: CSSProperties = { display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' };
const versionOff: CSSProperties = {
  padding: '2px 8px',
  borderRadius: 6,
  border: '1px solid var(--border-default, #e2e8f0)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 'var(--fontSize-xs)',
};
const versionOn: CSSProperties = { ...versionOff, borderColor: 'var(--primary-default, #2563eb)' };
const primaryBtn: CSSProperties = {
  marginTop: 6,
  padding: '6px 12px',
  borderRadius: 6,
  border: 0,
  background: 'var(--primary-default, #2563eb)',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};
const ghostBtn: CSSProperties = {
  marginTop: 6,
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid var(--border-default, #e2e8f0)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 'var(--fontSize-xs)',
};
const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 };
const muted: CSSProperties = { color: 'var(--foreground-muted, #64748b)', fontSize: 'var(--fontSize-xs)' };
const warn: CSSProperties = {
  background: 'var(--warning-subtle, #fffbeb)',
  border: '1px solid #fde68a',
  color: '#92400e',
  padding: '6px 8px',
  borderRadius: 6,
  fontSize: 'var(--fontSize-xs)',
  margin: '6px 0',
};
