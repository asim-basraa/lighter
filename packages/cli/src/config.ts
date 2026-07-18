import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Thrown for bad invocation (missing endpoint, unknown command); the entrypoint maps it to exit 1. */
export class UsageError extends Error {}

export interface LighterConfig {
  /** The cloud Lighter endpoint. Always required — Lighter is hosted (localhost for local dev). */
  url: string;
  /** Project API token (bearer). Required for project-scoped commands. */
  token?: string;
}

/** Read a `--name value` flag from argv, or undefined. */
export function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

/** Whether a boolean `--name` flag is present. */
export function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

/** Flags that take a following value (everything else is treated as a boolean flag). */
const VALUE_FLAGS = new Set([
  '--url',
  '--token',
  '--dir',
  '--version',
  '--expires',
  '--screen',
  '--tokens-dtcg',
]);

/** Split argv into positional args and flags. `--value-flag x` consumes `x`; other `--flags` are booleans. */
export function parseArgs(argv: string[]): {
  positionals: string[];
  flags: Record<string, string | boolean>;
} {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token.startsWith('--')) {
      const next = argv[i + 1];
      if (VALUE_FLAGS.has(token) && next !== undefined && !next.startsWith('--')) {
        flags[token] = next;
        i++;
      } else {
        flags[token] = true;
      }
    } else {
      positionals.push(token);
    }
  }
  return { positionals, flags };
}

/** Load `lighter.config.json` from a directory; returns {} if absent or unreadable/invalid. */
export function loadConfigFile(cwd: string): { url?: string; token?: string } {
  try {
    const parsed = JSON.parse(readFileSync(join(cwd, 'lighter.config.json'), 'utf8')) as {
      url?: unknown;
      token?: unknown;
    };
    return {
      url: typeof parsed.url === 'string' ? parsed.url : undefined,
      token: typeof parsed.token === 'string' ? parsed.token : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Resolve the endpoint + token with precedence **flags › env (`LIGHTER_URL`/`LIGHTER_TOKEN`) ›
 * `lighter.config.json`**. The endpoint is always required; the token is validated per-command (so
 * a plain `help` doesn't fail early).
 */
export function resolveConfig(
  argv: string[],
  env: NodeJS.ProcessEnv,
  file: { url?: string; token?: string } = {},
): LighterConfig {
  const url = flagValue(argv, '--url') ?? env.LIGHTER_URL ?? file.url;
  const token = flagValue(argv, '--token') ?? env.LIGHTER_TOKEN ?? file.token;
  if (!url) {
    throw new UsageError(
      'No Lighter endpoint. Pass --url, set LIGHTER_URL, or add "url" to lighter.config.json.',
    );
  }
  return { url, token };
}
