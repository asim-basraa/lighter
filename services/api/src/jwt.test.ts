import { describe, it, expect } from 'vitest';
import { createHmac, createSign, generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import { hs256Verifier, jwksVerifier, supabaseVerifierFromEnv, JwtError } from './jwt.js';

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const NOW = 1_700_000_000;
const now = () => NOW;

function hs256Token(payload: Record<string, unknown>, secret: string): string {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** Build an ES256 or RS256 token + the matching public JWK (with a kid). */
function asymmetricToken(alg: 'ES256' | 'RS256', payload: Record<string, unknown>, kid = 'k1') {
  const { privateKey, publicKey } =
    alg === 'ES256'
      ? generateKeyPairSync('ec', { namedCurve: 'P-256' })
      : generateKeyPairSync('rsa', { modulusLength: 2048 });
  const head = b64({ alg, typ: 'JWT', kid });
  const body = b64(payload);
  const data = Buffer.from(`${head}.${body}`);
  const signature =
    alg === 'ES256'
      ? cryptoSign('sha256', data, { key: privateKey, dsaEncoding: 'ieee-p1363' })
      : createSign('RSA-SHA256').update(data).sign(privateKey);
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg, use: 'sig' };
  return { token: `${head}.${body}.${signature.toString('base64url')}`, jwk };
}

const jwksFetch = (jwks: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(jwks), { status: 200 })) as unknown as typeof fetch;

describe('HS256 verification', () => {
  const secret = 'super-secret';

  it('verifies a valid token and extracts sub + email', async () => {
    const token = hs256Token({ sub: 'user-1', email: 'a@x.com', exp: NOW + 3600 }, secret);
    const claims = await hs256Verifier({ secret, now }).verify(token);
    expect(claims).toEqual({ userId: 'user-1', email: 'a@x.com' });
  });

  it('rejects an expired token', async () => {
    const token = hs256Token({ sub: 'user-1', exp: NOW - 1 }, secret);
    await expect(hs256Verifier({ secret, now }).verify(token)).rejects.toBeInstanceOf(JwtError);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = hs256Token({ sub: 'user-1', exp: NOW + 3600 }, 'other-secret');
    await expect(hs256Verifier({ secret, now }).verify(token)).rejects.toThrow(/bad signature/);
  });

  it('rejects a token with no subject', async () => {
    const token = hs256Token({ email: 'a@x.com', exp: NOW + 3600 }, secret);
    await expect(hs256Verifier({ secret, now }).verify(token)).rejects.toThrow(/no subject/);
  });
});

describe('asymmetric (JWKS) verification', () => {
  it('verifies an ES256 token against its JWKS', async () => {
    const { token, jwk } = asymmetricToken('ES256', {
      sub: 'user-2',
      email: 'b@x.com',
      exp: NOW + 3600,
    });
    const v = jwksVerifier({ jwksUrl: 'https://sb/jwks', fetch: jwksFetch({ keys: [jwk] }), now });
    expect(await v.verify(token)).toEqual({ userId: 'user-2', email: 'b@x.com' });
  });

  it('verifies an RS256 token against its JWKS', async () => {
    const { token, jwk } = asymmetricToken('RS256', { sub: 'user-3', exp: NOW + 3600 });
    const v = jwksVerifier({ jwksUrl: 'https://sb/jwks', fetch: jwksFetch({ keys: [jwk] }), now });
    expect(await v.verify(token)).toEqual({ userId: 'user-3', email: null });
  });

  it('rejects when no JWKS key matches the token kid (after a refetch)', async () => {
    const { token } = asymmetricToken('ES256', { sub: 'user-2', exp: NOW + 3600 }, 'k1');
    const { jwk: otherJwk } = asymmetricToken('ES256', { sub: 'x', exp: NOW + 3600 }, 'k2');
    const v = jwksVerifier({
      jwksUrl: 'https://sb/jwks',
      fetch: jwksFetch({ keys: [otherJwk] }),
      now,
    });
    await expect(v.verify(token)).rejects.toThrow(/no matching signing key/);
  });

  it('rejects a tampered ES256 payload', async () => {
    const { token, jwk } = asymmetricToken('ES256', { sub: 'user-2', exp: NOW + 3600 });
    const [h, , s] = token.split('.');
    const forged = `${h}.${b64({ sub: 'admin', exp: NOW + 3600 })}.${s}`;
    const v = jwksVerifier({ jwksUrl: 'https://sb/jwks', fetch: jwksFetch({ keys: [jwk] }), now });
    await expect(v.verify(forged)).rejects.toThrow(/bad signature/);
  });
});

describe('supabaseVerifierFromEnv', () => {
  it('prefers an HS256 secret', async () => {
    const v = supabaseVerifierFromEnv({ SUPABASE_JWT_SECRET: 'secret' }, { now });
    const token = hs256Token({ sub: 'u', exp: NOW + 10 }, 'secret');
    expect(await v!.verify(token)).toMatchObject({ userId: 'u' });
  });

  it('derives a JWKS URL from SUPABASE_URL', async () => {
    const { token, jwk } = asymmetricToken('ES256', { sub: 'u', exp: NOW + 10 });
    const v = supabaseVerifierFromEnv(
      { SUPABASE_URL: 'https://ref.supabase.co/' },
      { fetch: jwksFetch({ keys: [jwk] }), now },
    );
    expect(await v!.verify(token)).toMatchObject({ userId: 'u' });
  });

  it('returns null when Supabase Auth is not configured', () => {
    expect(supabaseVerifierFromEnv({})).toBeNull();
  });
});
