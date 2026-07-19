import { describe, it, expect } from 'vitest';
import { publicOrigin } from './publicOrigin.js';

const req = (url: string, headers: Record<string, string> = {}) => ({
  url,
  headers: new Headers(headers),
});

describe('publicOrigin (#149)', () => {
  it('prefers the forwarded proto + host over the container bind address', () => {
    // What Railway actually sends: the request URL is the internal bind address.
    const r = req('http://0.0.0.0:8080/auth/callback', {
      'x-forwarded-host': 'web-staging-4fd9.up.railway.app',
      'x-forwarded-proto': 'https',
    });
    expect(publicOrigin(r)).toBe('https://web-staging-4fd9.up.railway.app');
  });

  it('defaults to https when only a forwarded host is present', () => {
    const r = req('http://0.0.0.0:8080/x', { 'x-forwarded-host': 'studio.example.com' });
    expect(publicOrigin(r)).toBe('https://studio.example.com');
  });

  it('takes the first entry of a forwarded chain', () => {
    const r = req('http://0.0.0.0:8080/x', {
      'x-forwarded-host': 'studio.example.com, internal.proxy',
      'x-forwarded-proto': 'https, http',
    });
    expect(publicOrigin(r)).toBe('https://studio.example.com');
  });

  it('falls back to the host header', () => {
    const r = req('http://0.0.0.0:8080/x', { host: 'studio.example.com' });
    expect(publicOrigin(r)).toBe('https://studio.example.com');
  });

  it('falls back to the request origin with no proxy headers (local dev)', () => {
    expect(publicOrigin(req('http://localhost:4000/auth/callback'))).toBe('http://localhost:4000');
  });
});
