import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LighterClient, type FetchFn } from './client.js';
import * as commands from './commands.js';

/** A fake `fetch` that routes on url/init and returns a JSON Response — no network. */
function fakeFetch(
  handler: (url: string, init?: RequestInit) => { status?: number; body: unknown },
): FetchFn {
  return (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const { status = 200, body } = handler(url, init);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as FetchFn;
}

const ctx = (client: LighterClient, cwd = '.', argv: string[] = []) => ({ client, cwd, argv });

describe('CLI commands (#92, #94)', () => {
  it('whoami prints the project', async () => {
    const client = new LighterClient(
      { url: 'http://x', token: 't' },
      fakeFetch(() => ({ body: { id: 'acme', name: 'Acme' } })),
    );
    expect(await commands.whoami(ctx(client))).toBe('Acme (acme)');
  });

  it('sends the bearer token on requests', async () => {
    let seenAuth: string | undefined;
    const client = new LighterClient(
      { url: 'http://x', token: 'tok-123' },
      fakeFetch((_u, init) => {
        seenAuth = (init?.headers as Record<string, string> | undefined)?.authorization;
        return { body: { id: 'a', name: 'A' } };
      }),
    );
    await commands.whoami(ctx(client));
    expect(seenAuth).toBe('Bearer tok-123');
  });

  it('sync reads dist artifacts and posts them to /inventory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lighter-cli-'));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(
      join(dir, 'dist', 'catalog.json'),
      JSON.stringify({ components: { Button: { description: 'b', props: {} } } }),
    );
    writeFileSync(join(dir, 'dist', 'tokens.json'), JSON.stringify({ 'color.a': '#fff' }));

    let postedUrl = '';
    let postedBody: { catalog?: { components?: Record<string, unknown> } } = {};
    const client = new LighterClient(
      { url: 'http://x', token: 't' },
      fakeFetch((url, init) => {
        postedUrl = url;
        postedBody = JSON.parse((init?.body as string) ?? '{}');
        return {
          status: 201,
          body: { status: 'ok', model: { components: [{ name: 'Button' }], tokens: [{ name: 'color.a' }] } },
        };
      }),
    );

    const out = await commands.sync(ctx(client, dir, ['--dir', 'dist']));
    expect(out).toBe('synced 1 components, 1 tokens');
    expect(postedUrl).toBe('http://x/inventory');
    expect(postedBody.catalog?.components?.Button).toBeTruthy();
    rmSync(dir, { recursive: true, force: true });
  });

  it('sync errors clearly when artifacts are missing', async () => {
    const client = new LighterClient({ url: 'http://x' }, fakeFetch(() => ({ body: {} })));
    await expect(commands.sync(ctx(client, '/nonexistent-dir', []))).rejects.toThrow(
      /could not read artifact/,
    );
  });

  it('surfaces API errors with the status', async () => {
    const client = new LighterClient(
      { url: 'http://x', token: 't' },
      fakeFetch(() => ({ status: 401, body: { message: 'invalid token' } })),
    );
    await expect(commands.whoami(ctx(client))).rejects.toThrow(/401/);
  });
});
