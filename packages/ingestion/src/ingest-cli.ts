import { pathToFileURL } from 'node:url';
import { ingest } from './ingest.js';

export class UsageError extends Error {}

/**
 * Parse CLI args and return the inventory model as pretty JSON. Exported (separate from `main`) so
 * the arg-parsing + wiring is unit-testable without spawning a subprocess.
 *
 * Usage: `lighter-ingest <repo-path> [--artifact-dir <dir>]`
 */
export function run(argv: string[]): string {
  const args = argv.slice(2);
  const repoPath = args.find((a) => !a.startsWith('--'));
  if (!repoPath) {
    throw new UsageError('Usage: lighter-ingest <repo-path> [--artifact-dir <dir>]');
  }
  const dirFlag = args.indexOf('--artifact-dir');
  const artifactDir = dirFlag >= 0 ? args[dirFlag + 1] : undefined;

  const model = ingest(repoPath, artifactDir ? { artifactDir } : {});
  return JSON.stringify(model, null, 2);
}

/* c8 ignore start -- thin process wrapper, exercised via run() */
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    console.log(run(process.argv));
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  }
}
/* c8 ignore stop */
