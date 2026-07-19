import type { CSSProperties } from 'react';
import { listMyProjects } from '../../lib/projects.js';
import { selectedProjectId } from '../../lib/session.js';
import { selectProjectAction, createProjectAction } from './actions.js';

/**
 * Project chooser (#91): pick which project to work in, or create one. The selected project is stored
 * in a cookie the dashboard fetchers read as `X-Lighter-Project`. Shown when a user has no project
 * selected (or clicks "switch project").
 */
export const dynamic = 'force-dynamic';

export default async function ProjectsPage({ searchParams }: { searchParams: { error?: string } }) {
  const projects = await listMyProjects();
  const current = selectedProjectId();

  return (
    <main style={wrap}>
      <div style={card}>
        <h1 style={title}>Choose a project</h1>
        {searchParams.error && (
          <p role="alert" style={errorText}>
            {searchParams.error}
          </p>
        )}

        {projects.length > 0 ? (
          <ul style={list}>
            {projects.map((p) => (
              <li key={p.id}>
                <form action={selectProjectAction}>
                  <input type="hidden" name="projectId" value={p.id} />
                  <button type="submit" style={p.id === current ? projectCurrent : projectButton}>
                    <span>{p.name}</span>
                    <span style={role}>{p.role}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p style={muted}>You're not in any project yet — create your first one.</p>
        )}

        <form action={createProjectAction} style={createForm}>
          <label style={muted} htmlFor="name">
            New project
          </label>
          <div style={createRow}>
            <input id="name" name="name" placeholder="Acme Store" required style={input} />
            <button type="submit" style={button}>
              Create
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

const wrap: CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '2rem',
};
const card: CSSProperties = {
  width: '100%',
  maxWidth: 420,
  padding: '2rem',
  border: '1px solid var(--color-neutral-300, #d4d4d8)',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};
const title: CSSProperties = { margin: 0, fontSize: '1.35rem' };
const list: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};
const projectButton: CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.7rem 0.9rem',
  borderRadius: 8,
  border: '1px solid var(--color-neutral-300, #d4d4d8)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '1rem',
};
const projectCurrent: CSSProperties = {
  ...projectButton,
  borderColor: 'var(--color-blue-600, #2563eb)',
  background: 'var(--color-blue-50, #eff6ff)',
};
const role: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-neutral-700, #52525b)',
  textTransform: 'uppercase',
};
const createForm: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginTop: '0.5rem',
};
const createRow: CSSProperties = { display: 'flex', gap: '0.5rem' };
const input: CSSProperties = {
  flex: 1,
  padding: '0.6rem 0.75rem',
  borderRadius: 8,
  border: '1px solid var(--color-neutral-300, #d4d4d8)',
  fontSize: '1rem',
};
const button: CSSProperties = {
  padding: '0.6rem 1rem',
  borderRadius: 8,
  border: 'none',
  background: 'var(--color-blue-600, #2563eb)',
  color: 'white',
  cursor: 'pointer',
};
const muted: CSSProperties = {
  margin: 0,
  color: 'var(--color-neutral-700, #52525b)',
  fontSize: '0.9rem',
};
const errorText: CSSProperties = {
  margin: 0,
  color: 'var(--color-red-600, #dc2626)',
  fontSize: '0.85rem',
};
