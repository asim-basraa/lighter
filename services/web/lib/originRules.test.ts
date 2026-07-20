import { describe, it, expect } from 'vitest';
import { isValidOrigin, isLoopbackOrigin, isMixedContentBlocked } from './originRules.js';

/**
 * These mirror the API's rules (@lighter/db). Both sides must agree on what an origin *is*, or the
 * studio will offer to frame something the server then refuses — or worse, the reverse.
 */
describe('isValidOrigin', () => {
  it('accepts bare origins', () => {
    for (const ok of ['http://localhost:4200', 'https://shop.example.com', 'https://a.b.c:8443']) {
      expect(isValidOrigin(ok), ok).toBe(true);
    }
  });

  it('rejects anything carrying a path, query, fragment or credentials', () => {
    for (const bad of [
      'https://evil.com/login',
      'https://evil.com?next=1',
      'https://evil.com#x',
      'https://user:pw@evil.com',
      'javascript:alert(1)',
      'data:text/html,<script>',
      'nonsense',
    ]) {
      expect(isValidOrigin(bad), bad).toBe(false);
    }
  });
});

describe('isLoopbackOrigin', () => {
  it('recognises the local machine but not lookalikes', () => {
    expect(isLoopbackOrigin('http://localhost:4200')).toBe(true);
    expect(isLoopbackOrigin('http://127.0.0.1:3000')).toBe(true);
    // A host that merely contains "localhost" is someone else's server.
    expect(isLoopbackOrigin('https://localhost.evil.com')).toBe(false);
  });
});

describe('isMixedContentBlocked', () => {
  it('flags an https studio framing an http app — including localhost', () => {
    expect(isMixedContentBlocked('https:', 'http://localhost:4200')).toBe(true);
    expect(isMixedContentBlocked('https:', 'https://shop.example.com')).toBe(false);
    expect(isMixedContentBlocked('http:', 'http://localhost:4200')).toBe(false);
  });
});
