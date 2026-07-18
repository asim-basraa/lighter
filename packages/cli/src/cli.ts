#!/usr/bin/env -S npx tsx
import { pathToFileURL } from 'node:url';
import { resolveConfig, loadConfigFile, UsageError } from './config.js';
import { LighterClient } from './client.js';
import * as commands from './commands.js';

const HELP = `lighter — Lighter cloud CLI

Usage: lighter <command> [--url <endpoint>] [--token <token>]

Config precedence: flags › env (LIGHTER_URL / LIGHTER_TOKEN) › lighter.config.json

Commands:
  whoami                        Show the authenticated project
  inventory                     Show the project's latest pushed inventory
  sync [--dir dist]             Push built {catalog,tokens}.json to the cloud
  screen create <name> [--shell]  Create a screen (--shell scaffolds a PageShell v1)
  generate "<intent>" [--screen <name>]  Generate a spec; --screen saves it as a screen
  deploy <screen> [--version N] [--expires <s>]  Deploy a version; prints its review URL
  open <screen>                 Deploy the latest version and print its review URL
  help                          Show this help
`;

/** Parse args, resolve config, dispatch to a command, and return its output line(s). */
export async function run(argv: string[], env: NodeJS.ProcessEnv, cwd: string): Promise<string> {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') return HELP;

  const config = resolveConfig(rest, env, loadConfigFile(cwd));
  const ctx = { client: new LighterClient(config), cwd, argv: rest };

  switch (command) {
    case 'whoami':
      return commands.whoami(ctx);
    case 'inventory':
      return commands.inventory(ctx);
    case 'sync':
      return commands.sync(ctx);
    case 'screen':
      return commands.screen(ctx);
    case 'generate':
      return commands.generate(ctx);
    case 'deploy':
      return commands.deploy(ctx);
    case 'open':
      return commands.open(ctx);
    default:
      throw new UsageError(`Unknown command "${command}". Run \`lighter help\`.`);
  }
}

/* c8 ignore start -- thin process wrapper, behavior covered via run() */
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  run(process.argv.slice(2), process.env, process.cwd())
    .then((out) => console.log(out))
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
/* c8 ignore stop */
