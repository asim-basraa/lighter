import {
  createHmac,
  createPublicKey,
  timingSafeEqual,
  verify as cryptoVerify,
  type KeyObject,
} from 'node:crypto';

/**
 * Supabase-Auth JWT verification (#91) with no third-party dependency — just `node:crypto`. Supports
 * the two token shapes a Supabase project can issue:
 *   - **HS256** with a shared `SUPABASE_JWT_SECRET` (legacy projects).
 *   - **Asymmetric** RS256 / ES256 verified against the project's JWKS (newer projects). The JWKS is
 *     fetched once and cached; an unknown `kid` forces one refetch to survive key rotation.
 *
 * The studio (human) lane authenticates with these tokens; the CLI lane keeps its project API tokens.
 * A failure always throws `JwtError` so the auth middleware can answer 401 without leaking detail.
 */
export class JwtError extends Error {}

/** The identity we extract from a verified token. */
export interface JwtClaims {
  userId: string;
  email: string | null;
}

export interface JwtVerifier {
  verify(token: string): Promise<JwtClaims>;
}

interface JwtHeader {
  alg: string;
  kid?: string;
}

function decodeJson<T>(segment: string): T {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
  } catch {
    throw new JwtError('malformed token segment');
  }
}

/** Split a compact JWT into its parts, returning the signing input and decoded header/payload. */
function parse(token: string): {
  header: JwtHeader;
  payload: Record<string, unknown>;
  signingInput: string;
  signature: Buffer;
} {
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('not a compact JWT');
  const [h, p, s] = parts;
  return {
    header: decodeJson<JwtHeader>(h!),
    payload: decodeJson<Record<string, unknown>>(p!),
    signingInput: `${h}.${p}`,
    signature: Buffer.from(s!, 'base64url'),
  };
}

/** Verify a signature for one of the supported algorithms. `key` is a secret (HS256) or a public key. */
function signatureValid(
  alg: string,
  signingInput: string,
  signature: Buffer,
  key: Buffer | KeyObject,
): boolean {
  const data = Buffer.from(signingInput);
  if (alg === 'HS256') {
    const expected = createHmac('sha256', key as Buffer)
      .update(data)
      .digest();
    return signature.length === expected.length && timingSafeEqual(signature, expected);
  }
  if (alg === 'RS256') {
    return cryptoVerify('sha256', data, key as KeyObject, signature);
  }
  if (alg === 'ES256') {
    // Supabase/JOSE emit ECDSA signatures in raw r||s (ieee-p1363) form, not DER.
    return cryptoVerify(
      'sha256',
      data,
      { key: key as KeyObject, dsaEncoding: 'ieee-p1363' },
      signature,
    );
  }
  throw new JwtError(`unsupported alg: ${alg}`);
}

/** Common claim checks + identity extraction, shared by both verifier flavors. */
function claimsFrom(payload: Record<string, unknown>, now: number): JwtClaims {
  const exp = payload.exp;
  if (typeof exp !== 'number' || exp <= now) throw new JwtError('token expired');
  const nbf = payload.nbf;
  if (typeof nbf === 'number' && nbf > now) throw new JwtError('token not yet valid');
  const sub = payload.sub;
  if (typeof sub !== 'string' || sub.length === 0) throw new JwtError('token has no subject');
  const email = typeof payload.email === 'string' ? payload.email : null;
  return { userId: sub, email };
}

export interface Hs256Config {
  secret: string;
  now?: () => number;
}

/** An HS256 verifier for a shared Supabase JWT secret. */
export function hs256Verifier(config: Hs256Config): JwtVerifier {
  const secret = Buffer.from(config.secret, 'utf8');
  const clock = config.now ?? (() => Math.floor(Date.now() / 1000));
  return {
    async verify(token) {
      const { header, payload, signingInput, signature } = parse(token);
      if (header.alg !== 'HS256') throw new JwtError(`expected HS256, got ${header.alg}`);
      if (!signatureValid('HS256', signingInput, signature, secret)) {
        throw new JwtError('bad signature');
      }
      return claimsFrom(payload, clock());
    },
  };
}

interface Jwk extends Record<string, unknown> {
  kid?: string;
}

export interface JwksConfig {
  jwksUrl: string;
  fetch?: typeof fetch;
  now?: () => number;
}

/** A verifier that checks asymmetric signatures against a project's remote JWKS (RS256/ES256). */
export function jwksVerifier(config: JwksConfig): JwtVerifier {
  const doFetch = config.fetch ?? fetch;
  const clock = config.now ?? (() => Math.floor(Date.now() / 1000));
  let cache: Map<string, KeyObject> | null = null;

  async function loadKeys(): Promise<Map<string, KeyObject>> {
    const res = await doFetch(config.jwksUrl);
    if (!res.ok) throw new JwtError(`JWKS fetch failed (${res.status})`);
    const body = (await res.json()) as { keys?: Jwk[] };
    const keys = new Map<string, KeyObject>();
    for (const jwk of body.keys ?? []) {
      if (!jwk.kid) continue;
      try {
        keys.set(jwk.kid, createPublicKey({ key: jwk as never, format: 'jwk' }));
      } catch {
        // Skip a key we can't import rather than failing the whole set.
      }
    }
    return keys;
  }

  async function keyFor(kid: string | undefined): Promise<KeyObject> {
    if (!kid) throw new JwtError('token has no kid');
    if (!cache) cache = await loadKeys();
    let key = cache.get(kid);
    if (!key) {
      // Unknown kid → the signing key may have rotated; refetch once.
      cache = await loadKeys();
      key = cache.get(kid);
    }
    if (!key) throw new JwtError('no matching signing key');
    return key;
  }

  return {
    async verify(token) {
      const { header, payload, signingInput, signature } = parse(token);
      if (header.alg !== 'RS256' && header.alg !== 'ES256') {
        throw new JwtError(`expected RS256/ES256, got ${header.alg}`);
      }
      const key = await keyFor(header.kid);
      if (!signatureValid(header.alg, signingInput, signature, key)) {
        throw new JwtError('bad signature');
      }
      return claimsFrom(payload, clock());
    },
  };
}

export interface SupabaseAuthEnv {
  SUPABASE_JWT_SECRET?: string;
  SUPABASE_JWKS_URL?: string;
  SUPABASE_URL?: string;
}

/**
 * Build a verifier from the service env, or null when Supabase Auth is not configured (so the JWT lane
 * simply doesn't mount and only project API tokens work). Precedence: an explicit HS256 secret, then an
 * explicit JWKS URL, then the JWKS derived from `SUPABASE_URL`.
 */
export function supabaseVerifierFromEnv(
  env: SupabaseAuthEnv,
  deps: { fetch?: typeof fetch; now?: () => number } = {},
): JwtVerifier | null {
  if (env.SUPABASE_JWT_SECRET) {
    return hs256Verifier({ secret: env.SUPABASE_JWT_SECRET, now: deps.now });
  }
  const jwksUrl =
    env.SUPABASE_JWKS_URL ??
    (env.SUPABASE_URL
      ? `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`
      : undefined);
  if (jwksUrl) return jwksVerifier({ jwksUrl, fetch: deps.fetch, now: deps.now });
  return null;
}
