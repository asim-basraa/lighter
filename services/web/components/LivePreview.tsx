'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  PROTOCOL_VERSION,
  asFrameMessage,
  isCompatible,
  type ParentMessage,
  type Box,
} from '@lighter/preview';
import type { Spec } from '@lighter/spec';
import { buildTokenCss, DEFAULT_EDITS, type TokenEdits } from '../lib/tokenOverrides.js';
import { OriginPicker } from './OriginPicker.js';
import { CanvasOverlay } from './CanvasOverlay.js';
import { SpecTree } from './SpecTree.js';
import { PropertyPanel } from './PropertyPanel.js';
import type { PreviewOrigin } from '../lib/originRules.js';
import {
  nodeAt,
  setProp,
  insertChild,
  removeAt,
  moveWithinParent,
  defaultNodeFor,
  pathForElementId,
  elementIdForPath,
  samePath,
  type Path,
} from '../lib/specEdit.js';

export interface CatalogComponent {
  name: string;
  slots: string[];
  props: Record<string, unknown>;
}

/**
 * Edit a screen against the REAL running app (#166).
 *
 * The iframe is the consumer app itself — its own routing, its own APIs, its own state. Lighter
 * pushes spec and token edits over `postMessage`; the app applies them in place. Nothing reloads, so
 * a cart stays full and a scroll position holds while the design is retuned.
 *
 * Editing is structural, not textual: a component tree plus a property panel generated from the
 * catalog's JSON Schema. Only *declared* props are editable — there is no arbitrary styling control,
 * because per-instance overrides would stop specs being compositions of approved components.
 *
 * Edits land in a mutable draft; **Push version** promotes it to an immutable version for review.
 */
export function LivePreview({
  screenId,
  versions,
  initialVersion,
  initialSpec,
  hasDraft = false,
  catalog,
  origin,
  allowedOrigins,
  mixedContentBlocked,
}: {
  screenId: string;
  versions: number[];
  initialVersion: number;
  initialSpec: Spec;
  /** True when `initialSpec` came from an unpushed draft rather than a stored version. */
  hasDraft?: boolean;
  /** The ingested design system: what may be inserted, and the schema driving the property panel. */
  catalog: CatalogComponent[];
  origin: string;
  allowedOrigins: PreviewOrigin[];
  mixedContentBlocked: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [connection, setConnection] = useState<'waiting' | 'connected' | 'incompatible'>('waiting');
  const [sdkVersion, setSdkVersion] = useState<string | null>(null);
  const [appPath, setAppPath] = useState<string | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);

  const [spec, setSpec] = useState<Spec>(initialSpec);
  const [selected, setSelected] = useState<Path | null>([]);
  const [showJson, setShowJson] = useState(false);
  const [edits, setEdits] = useState<TokenEdits>(DEFAULT_EDITS);
  const [draftState, setDraftState] = useState<'clean' | 'saving' | 'saved' | 'error'>(
    hasDraft ? 'saved' : 'clean',
  );
  const [pushed, setPushed] = useState<number | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  /** 'browse' leaves the prototype fully interactive; 'select' claims clicks for picking elements. */
  const [mode, setMode] = useState<'browse' | 'select'>('select');
  const [hoverBox, setHoverBox] = useState<Box | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [frameRect, setFrameRect] = useState<DOMRect | null>(null);

  const post = useCallback(
    (message: ParentMessage) => {
      frame.current?.contentWindow?.postMessage(message, origin);
    },
    [origin],
  );

  /**
   * Spec-derived lookups the message listener needs, held in refs.
   *
   * The listener is subscribed once per origin; reading `spec` directly would force it to
   * re-subscribe on every keystroke, and a re-subscribe drops in-flight messages from the frame.
   */
  const connectedRef = useRef(false);
  const typeOfElementRef = useRef<(id: string) => string | null>(() => null);
  const pathForElementIdRef = useRef<(id: string) => Path | null>(() => null);
  const selectedElementIdRef = useRef<string | null>(null);

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
        connectedRef.current = true;
      } else if (message.type === 'lighter:navigated') {
        setAppPath(message.path);
      } else if (message.type === 'lighter:error') {
        setFrameError(message.message);
      } else if (message.type === 'lighter:element') {
        const hit = message.element;
        if (message.kind === 'hover') {
          setHoverBox(hit?.box ?? null);
          setHoverLabel(hit ? typeOfElementRef.current(hit.id) : null);
        } else if (message.kind === 'measure') {
          // Box only. Re-applying the selection here would re-trigger the measure that produced it.
          setSelectedBox(hit?.box ?? null);
        } else if (hit) {
          // A click on the canvas selects the corresponding node in the tree — the two views are
          // the same selection, not two selections that happen to agree.
          const path = pathForElementIdRef.current(hit.id);
          // Only replace the selection when it actually differs: `path` is a fresh array every time,
          // so assigning an equal one still changes identity and would re-run the measure effect.
          if (path) setSelected((current) => (current && samePath(current, path) ? current : path));
          setSelectedBox(hit.box);
        }
      } else if (message.type === 'lighter:layout') {
        setFrameRect(frame.current?.getBoundingClientRect() ?? null);
        // The frame scrolled or resized: whatever we're outlining has moved, so ask for a fresh box
        // rather than leaving a stale rectangle floating over the app.
        const id = selectedElementIdRef.current;
        if (id) post({ type: 'lighter:measure', elementId: id });
      }
    };
    window.addEventListener('message', onMessage);
    // Ask any already-running app to re-announce itself. Without this, a studio that remounts (hot
    // reload, refresh, route change) waits forever: the app said hello before we were listening and
    // has no reason to repeat it.
    const ping = () => {
      if (!connectedRef.current) post({ type: 'lighter:ping' });
    };
    ping();
    const retry = setInterval(ping, 1000);
    const stop = setTimeout(() => clearInterval(retry), 10_000);
    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(retry);
      clearTimeout(stop);
    };
  }, [origin, post]);

  const tokenCss = useMemo(() => buildTokenCss(edits), [edits]);

  // Token edits stream continuously — a stylesheet swap is about one frame, so no debounce.
  useEffect(() => {
    if (connection !== 'connected') return;
    post({ type: 'lighter:tokens', css: tokenCss });
  }, [tokenCss, connection, post]);

  // Spec edits push to the frame promptly — this is the thing the author is watching.
  useEffect(() => {
    if (connection !== 'connected') return;
    const id = setTimeout(() => post({ type: 'lighter:spec', screenId, version: null, spec }), 120);
    return () => clearTimeout(id);
  }, [spec, connection, post, screenId]);

  /**
   * Persist to the screen's mutable DRAFT, not a new version.
   *
   * Debounced well behind the preview push: the frame updating is what the author sees, the save is
   * bookkeeping. Skipped while the spec still equals what was loaded, so opening a screen and
   * touching nothing doesn't create a draft.
   */
  useEffect(() => {
    if (spec === initialSpec) return;
    const id = setTimeout(async () => {
      setDraftState('saving');
      try {
        const res = await fetch(`/api/screens/${encodeURIComponent(screenId)}/draft`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ spec }),
        });
        setDraftState(res.ok ? 'saved' : 'error');
      } catch {
        setDraftState('error');
      }
    }, 800);
    return () => clearTimeout(id);
  }, [spec, initialSpec, screenId]);

  /** Promote the draft to a new immutable version — the deliberate publishing act. */
  const push = useCallback(async () => {
    setPushError(null);
    const res = await fetch(`/api/screens/${encodeURIComponent(screenId)}/draft/promote`, {
      method: 'POST',
    });
    const body = (await res.json().catch(() => ({}))) as {
      version?: number;
      message?: string;
      issues?: unknown[];
    };
    if (!res.ok) {
      const detail = Array.isArray(body.issues) && body.issues.length ? ` (${body.issues.length} issue${body.issues.length === 1 ? '' : 's'})` : '';
      setPushError((body.message ?? 'Could not push a version.') + detail);
      return;
    }
    setPushed(body.version ?? null);
    setDraftState('clean');
  }, [screenId]);

  const loadVersion = useCallback(
    async (version: number) => {
      const res = await fetch(`/api/screens/${encodeURIComponent(screenId)}/versions/${version}`);
      if (!res.ok) {
        setSpecError(`Could not load v${version}.`);
        return;
      }
      const body = (await res.json()) as { spec: Spec };
      setSpec(body.spec);
      setSelected([]);
    },
    [screenId],
  );
  const [specError, setSpecError] = useState<string | null>(null);

  const schemaFor = useCallback(
    (type: string) => catalog.find((c) => c.name === type)?.props,
    [catalog],
  );
  const selectedNode = selected ? nodeAt(spec, selected) : null;

  // Keep the listener's lookups pointed at the current spec/selection without re-subscribing it.
  useEffect(() => {
    typeOfElementRef.current = (id) => {
      const path = pathForElementId(spec, id);
      return path ? (nodeAt(spec, path)?.type ?? null) : null;
    };
    pathForElementIdRef.current = (id) => pathForElementId(spec, id);
    selectedElementIdRef.current = selected ? elementIdForPath(spec, selected) : null;
  }, [spec, selected]);

  /**
   * Turn hit-testing on in the app while in select mode.
   *
   * Off in browse mode so the prototype behaves normally — clicking a link follows it, which is the
   * point of previewing a real app rather than a mock.
   */
  useEffect(() => {
    if (connection !== 'connected') return;
    post({ type: 'lighter:annotate', enabled: mode === 'select' });
    if (mode === 'browse') {
      setHoverBox(null);
      setHoverLabel(null);
    }
  }, [mode, connection, post]);

  /** Re-outline the selection when it changes in the TREE, so both views stay in step. */
  useEffect(() => {
    if (connection !== 'connected' || mode !== 'select') return;
    const id = selected ? elementIdForPath(spec, selected) : null;
    if (id) post({ type: 'lighter:measure', elementId: id });
    else setSelectedBox(null);
  }, [selected, spec, connection, mode, post]);

  // The overlay is positioned from the iframe's own rect, so track it as the window changes.
  useEffect(() => {
    const measure = () => setFrameRect(frame.current?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, []);

  // Belt and braces alongside the no-op guard in specEdit: if a selection stops resolving (its node
  // was deleted, or an ancestor moved), fall back to the root rather than holding a path that points
  // at nothing.
  useEffect(() => {
    if (selected && !nodeAt(spec, selected)) setSelected([]);
  }, [spec, selected]);

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
        {catalog.length === 0 && (
          <p style={warn}>
            No design system ingested for this project, so components can’t be added and properties
            can’t be edited. Run <code>lighter sync</code> first.
          </p>
        )}

        <section style={group}>
          <h2 style={groupTitle}>Structure</h2>
          <SpecTree
            spec={spec}
            catalog={catalog}
            selected={selected}
            onSelect={setSelected}
            onInsert={(parent, type) => {
              setSpec((s) => insertChild(s, parent, defaultNodeFor(type, schemaFor(type))));
              setSelected(parent);
            }}
            onRemove={(path) => {
              setSpec((s) => removeAt(s, path));
              setSelected([]);
            }}
            onMove={(path, delta) => setSpec((s) => moveWithinParent(s, path, delta))}
          />
        </section>

        <section style={group}>
          <h2 style={groupTitle}>
            {selectedNode ? `${selectedNode.type} properties` : 'Properties'}
          </h2>
          {selectedNode ? (
            <PropertyPanel
              node={selectedNode}
              propsSchema={schemaFor(selectedNode.type)}
              onChange={(key, value) =>
                setSpec((s) => (selected ? setProp(s, selected, key, value) : s))
              }
            />
          ) : (
            <p style={muted}>Select a component in the tree.</p>
          )}
        </section>

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
          <p style={hint}>Token edits preview only — they don’t change the stored token set.</p>
        </section>

        <section style={group}>
          <h2 style={groupTitle}>Version</h2>
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
          {specError && <p style={warn}>{specError}</p>}

          <div style={pushRow}>
            <button type="button" style={primaryBtn} onClick={() => void push()}>
              Push version
            </button>
            <span style={muted}>
              {draftState === 'saving'
                ? 'saving draft…'
                : draftState === 'saved'
                  ? 'draft saved'
                  : draftState === 'error'
                    ? 'draft not saved'
                    : pushed
                      ? `pushed v${pushed}`
                      : ''}
            </span>
          </div>
          {pushError && <p style={warn}>{pushError}</p>}
          <p style={hint}>
            Edits live in a draft. Pushing promotes it to an immutable version for review.
          </p>
        </section>

        <section style={group}>
          <h2 style={groupTitle}>App</h2>
          <OriginPicker
            current={origin}
            allowed={allowedOrigins}
            screenId={screenId}
            version={initialVersion}
          />
          {appPath && (
            <p style={muted}>
              at <code>{appPath}</code>
            </p>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={ghostBtn} onClick={() => post({ type: 'lighter:refresh' })}>
              Refresh data
            </button>
            <button type="button" style={ghostBtn} onClick={() => post({ type: 'lighter:refresh', hard: true })}>
              Hard reload
            </button>
          </div>
        </section>

        <section style={group}>
          <button type="button" style={ghostBtn} onClick={() => setShowJson((v) => !v)}>
            {showJson ? 'Hide' : 'Show'} spec JSON
          </button>
          {showJson && (
            <textarea readOnly value={JSON.stringify(spec, null, 2)} style={jsonView} spellCheck={false} />
          )}
        </section>
      </aside>

      <div style={stage}>
        <div style={modeBar} role="group" aria-label="Canvas mode">
          <button
            type="button"
            onClick={() => setMode('browse')}
            style={mode === 'browse' ? modeOn : modeOff}
            aria-pressed={mode === 'browse'}
          >
            Browse
          </button>
          <button
            type="button"
            onClick={() => setMode('select')}
            style={mode === 'select' ? modeOn : modeOff}
            aria-pressed={mode === 'select'}
          >
            Select
          </button>
        </div>
        <iframe
          ref={frame}
          src={origin}
          title={`Live preview of ${screenId}`}
          style={iframeStyle}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>

      <CanvasOverlay
        active={mode === 'select'}
        frameRect={frameRect}
        hover={hoverBox}
        selected={selectedBox}
        label={hoverLabel}
      />
    </div>
  );
}

function ConnectionPill({ state, sdkVersion }: { state: string; sdkVersion: string | null }) {
  const tone = state === 'connected' ? '#16a34a' : state === 'incompatible' ? '#dc2626' : '#94a3b8';
  const label =
    state === 'connected'
      ? `connected${sdkVersion ? ` · sdk ${sdkVersion}` : ''}`
      : state === 'incompatible'
        ? 'incompatible'
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
      <input type="range" min={min} max={max} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

const shell: CSSProperties = { display: 'flex', height: '100vh', overflow: 'hidden' };
const rail: CSSProperties = {
  width: 340,
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
const stage: CSSProperties = { flex: 1, minWidth: 0, background: '#fff', position: 'relative' };
const modeBar: CSSProperties = {
  position: 'absolute',
  right: 12,
  bottom: 12,
  zIndex: 61,
  display: 'inline-flex',
  borderRadius: 999,
  overflow: 'hidden',
  border: '1px solid var(--border-default, #e2e8f0)',
  background: 'color-mix(in srgb, var(--background-canvas, #fff) 92%, transparent)',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 4px 14px rgb(15 23 42 / 0.12)',
};
const modeOff: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: '5px 12px',
  cursor: 'pointer',
  fontSize: 11,
  color: 'var(--foreground-muted, #64748b)',
};
const modeOn: CSSProperties = {
  ...modeOff,
  background: 'var(--primary-default, #2563eb)',
  color: '#fff',
  fontWeight: 600,
};
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
const pushRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 };
const primaryBtn: CSSProperties = {
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
const jsonView: CSSProperties = {
  width: '100%',
  height: 200,
  marginTop: 6,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: 10,
  padding: 6,
  borderRadius: 6,
  border: '1px solid var(--border-default, #e2e8f0)',
};
const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 };
const muted: CSSProperties = { color: 'var(--foreground-muted, #64748b)', fontSize: 'var(--fontSize-xs)' };
const hint: CSSProperties = { fontSize: 10, color: 'var(--foreground-muted, #64748b)', margin: '6px 0 0' };
const warn: CSSProperties = {
  background: 'var(--warning-subtle, #fffbeb)',
  border: '1px solid #fde68a',
  color: '#92400e',
  padding: '6px 8px',
  borderRadius: 6,
  fontSize: 'var(--fontSize-xs)',
  margin: '6px 0',
};
