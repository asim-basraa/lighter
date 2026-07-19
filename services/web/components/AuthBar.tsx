import type { CSSProperties } from 'react';
import Link from 'next/link';

/**
 * The signed-in context bar above the dashboard nav (#91): the current project (+ role), a link to
 * switch projects, the user's email, and sign-out. Sign-out is a plain form POST to the route handler
 * so it needs no client JS.
 */
export function AuthBar({
  projectName,
  role,
  email,
}: {
  projectName: string;
  role: string;
  email: string | null;
}) {
  return (
    <div style={bar}>
      <div style={left}>
        <span style={project}>{projectName}</span>
        <span style={roleTag}>{role}</span>
        <Link href="/projects" style={link}>
          Switch
        </Link>
      </div>
      <div style={right}>
        {email && <span style={muted}>{email}</span>}
        <form action="/auth/signout" method="post">
          <button type="submit" style={signout}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

const bar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.4rem 1.5rem',
  background: 'var(--color-neutral-100, #f4f4f5)',
  borderBottom: '1px solid var(--color-neutral-200, #e4e4e7)',
  fontSize: '0.85rem',
};
const left: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem' };
const right: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem' };
const project: CSSProperties = { fontWeight: 600 };
const roleTag: CSSProperties = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  color: 'var(--color-neutral-700, #52525b)',
  border: '1px solid var(--color-neutral-300, #d4d4d8)',
  borderRadius: 4,
  padding: '0 0.35rem',
};
const link: CSSProperties = { color: 'var(--color-blue-700, #1d4ed8)', textDecoration: 'none' };
const muted: CSSProperties = { color: 'var(--color-neutral-700, #52525b)' };
const signout: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-neutral-300, #d4d4d8)',
  borderRadius: 6,
  padding: '0.2rem 0.6rem',
  cursor: 'pointer',
  fontSize: '0.8rem',
};
