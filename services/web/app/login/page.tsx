'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { supabaseBrowser } from '../../lib/supabase/client.js';

/**
 * Studio login (#91) — passwordless magic link. Enter an email, Supabase emails a sign-in link; the
 * link lands on `/auth/callback` which exchanges it for a session. On a build without Supabase env the
 * middleware never redirects here, so this page is only reached when auth is configured.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setPending(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setPending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main style={wrap}>
      <div style={card}>
        <h1 style={title}>Lighter</h1>
        {sent ? (
          <p style={muted} role="status">
            Check your email — we sent a sign-in link to <strong>{email}</strong>.
          </p>
        ) : (
          <form onSubmit={onSubmit} style={form}>
            <label style={muted} htmlFor="email">
              Sign in with a magic link
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
            <button type="submit" disabled={pending || !email.trim()} style={button}>
              {pending ? 'Sending…' : 'Send magic link'}
            </button>
            {error && (
              <p role="alert" style={errorText}>
                {error}
              </p>
            )}
          </form>
        )}
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
  maxWidth: 360,
  padding: '2rem',
  border: '1px solid var(--color-neutral-300, #d4d4d8)',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};
const title: CSSProperties = { margin: 0, fontSize: '1.5rem' };
const form: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };
const input: CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderRadius: 8,
  border: '1px solid var(--color-neutral-300, #d4d4d8)',
  fontSize: '1rem',
};
const button: CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderRadius: 8,
  border: 'none',
  background: 'var(--color-blue-600, #2563eb)',
  color: 'white',
  fontSize: '1rem',
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
