import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LighterClient } from './client.js';
import { flagValue, parseArgs } from './config.js';

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

/** A minimal scaffold spec: a titled `PageShell` — the layout-owning root every screen starts from. */
function shellSpec(title: string): unknown {
  return { root: { type: 'PageShell', props: { title }, children: [] } };
}

/**
 * `screen create <name> [--shell]` → create a screen; with `--shell`, also save a v1 scaffolded from a
 * `PageShell` (the design-system's layout root). Requires `PageShell` in the project's catalog.
 */
export async function screen(ctx: CommandContext): Promise<string> {
  const { positionals, flags } = parseArgs(ctx.argv);
  const [sub, name] = positionals;
  if (sub !== 'create') {
    throw new Error(`unknown screen subcommand "${sub ?? ''}". Try: lighter screen create <name> [--shell]`);
  }
  if (!name) {
    throw new Error('screen create needs a name: lighter screen create <name> [--shell]');
  }
  const meta = await ctx.client.createScreen(name);
  if (flags['--shell']) {
    const { version } = await ctx.client.saveVersion(meta.id, shellSpec(meta.name));
    return `created screen ${meta.id} with a shell page (v${version})`;
  }
  return `created screen ${meta.id}`;
}

/**
 * `generate "<intent>" [--screen <name>]` → generate a catalog-constrained spec. With `--screen`,
 * create that screen and save the spec as its v1; otherwise print the spec.
 */
export async function generate(ctx: CommandContext): Promise<string> {
  const { positionals, flags } = parseArgs(ctx.argv);
  const intent = positionals[0];
  if (!intent) {
    throw new Error('generate needs an intent: lighter generate "<intent>" [--screen <name>]');
  }
  const { spec } = await ctx.client.generate(intent);
  if (typeof flags['--screen'] === 'string') {
    const meta = await ctx.client.createScreen(flags['--screen']);
    const { version } = await ctx.client.saveVersion(meta.id, spec);
    return `generated and saved screen ${meta.id} (v${version})`;
  }
  return JSON.stringify(spec, null, 2);
}

/** Resolve the version to deploy: an explicit `--version`, or the screen's latest. */
async function resolveVersion(ctx: CommandContext, id: string, flag: string | boolean | undefined) {
  if (typeof flag === 'string') {
    const v = Number(flag);
    if (!Number.isInteger(v) || v < 1) throw new Error('--version must be a positive integer');
    return v;
  }
  const latest = (await ctx.client.getScreen(id)).versions.at(-1);
  if (latest === undefined) throw new Error(`screen "${id}" has no versions to deploy`);
  return latest;
}

/** `deploy <screen> [--version N] [--expires <seconds>]` → deploy a version, print its review URL. */
export async function deploy(ctx: CommandContext): Promise<string> {
  const { positionals, flags } = parseArgs(ctx.argv);
  const id = positionals[0];
  if (!id) {
    throw new Error('deploy needs a screen id: lighter deploy <screen> [--version N] [--expires <seconds>]');
  }
  const version = await resolveVersion(ctx, id, flags['--version']);
  let expires: number | undefined;
  if (typeof flags['--expires'] === 'string') {
    expires = Number(flags['--expires']);
    if (!Number.isFinite(expires) || expires <= 0) {
      throw new Error('--expires must be a positive number of seconds');
    }
  }
  const { token } = await ctx.client.deploy(id, version, expires);
  return ctx.client.shareUrl(token);
}

/** `open <screen>` → deploy the screen's latest version (idempotent) and print its review URL. */
export async function open(ctx: CommandContext): Promise<string> {
  const { positionals } = parseArgs(ctx.argv);
  const id = positionals[0];
  if (!id) throw new Error('open needs a screen id: lighter open <screen>');
  const version = await resolveVersion(ctx, id, undefined);
  const { token } = await ctx.client.deploy(id, version);
  return ctx.client.shareUrl(token);
}
