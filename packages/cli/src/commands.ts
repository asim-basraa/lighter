import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LighterClient } from './client.js';
import { flagValue } from './config.js';

export interface CommandContext {
  client: LighterClient;
  cwd: string;
  /** The command's args (everything after the command name). */
  argv: string[];
}

/** `whoami` → the authenticated project. */
export async function whoami(ctx: CommandContext): Promise<string> {
  const p = await ctx.client.whoami();
  return `${p.name} (${p.id})`;
}

/** `inventory` → a one-line summary of the project's latest pushed inventory. */
export async function inventory(ctx: CommandContext): Promise<string> {
  const inv = await ctx.client.inventory();
  return `${inv.components.length} components, ${inv.tokens.length} tokens`;
}

/**
 * `sync [--dir dist]` → read the built `{catalog,tokens}.json` from the artifact dir and push them to
 * the cloud (#94). Assumes the design system is already built (`pnpm build`); building/adapting from
 * Storybook is a later slice.
 */
export async function sync(ctx: CommandContext): Promise<string> {
  const dir = flagValue(ctx.argv, '--dir') ?? 'dist';
  const catalog = readArtifact(ctx.cwd, dir, 'catalog.json');
  const tokens = readArtifact(ctx.cwd, dir, 'tokens.json');
  const { model } = await ctx.client.pushInventory(catalog, tokens);
  return `synced ${model.components.length} components, ${model.tokens.length} tokens`;
}

function readArtifact(cwd: string, dir: string, file: string): unknown {
  const path = join(cwd, dir, file);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(
      `could not read artifact ${join(dir, file)}: ${(err as Error).message}. ` +
        `Build the design system first (e.g. \`pnpm build\`), or pass --dir.`,
    );
  }
}
