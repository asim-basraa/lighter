import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SpecSchema, type Spec } from '@lighter/spec';

const exec = promisify(execFile);

/** A screen: an addressable design surface that owns an ordered series of spec versions. */
export interface ScreenMeta {
  id: string;
  name: string;
}

/** Thrown when creating a screen whose id already exists. Routes map this to 409. */
export class ScreenExistsError extends Error {}

/** Derive a stable, filesystem-safe screen id from a human name. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A git-backed store for screens and their spec versions. Layout under `root`:
 *
 *   <root>/<screenId>/screen.json      screen metadata { id, name }
 *   <root>/<screenId>/<n>.json         internal spec for version n (immutable; 1, 2, 3, …)
 *
 * Every mutation is committed, so `root` is a full version history in git (conversational state is
 * kept in the DB, not here). Versions are immutable files — a new version is a new file, never an
 * edit — so `git log` reads as the design timeline. Reads are plain filesystem access.
 */
export class SpecStore {
  constructor(private readonly root: string) {}

  /** Ensure `root` exists and is a git repo with a local commit identity. Idempotent. */
  async init(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    if (!existsSync(join(this.root, '.git'))) {
      await this.git(['init', '--quiet']);
      await this.git(['config', 'user.email', 'lighter@localhost']);
      await this.git(['config', 'user.name', 'Lighter']);
      await this.git(['config', 'commit.gpgsign', 'false']);
    }
  }

  async createScreen(name: string): Promise<ScreenMeta> {
    const id = slugify(name);
    if (id.length === 0) {
      throw new Error('Screen name must contain at least one alphanumeric character');
    }
    const dir = join(this.root, id);
    if (existsSync(dir)) {
      throw new ScreenExistsError(`Screen "${id}" already exists`);
    }
    const meta: ScreenMeta = { id, name };
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'screen.json'), `${JSON.stringify(meta, null, 2)}\n`);
    await this.commit(`Create screen ${id}`);
    return meta;
  }

  async listScreens(): Promise<ScreenMeta[]> {
    if (!existsSync(this.root)) return [];
    const entries = await readdir(this.root, { withFileTypes: true });
    const metas: ScreenMeta[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '.git') continue;
      const meta = await this.getScreen(entry.name);
      if (meta) metas.push(meta);
    }
    return metas.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getScreen(id: string): Promise<ScreenMeta | null> {
    const path = join(this.root, id, 'screen.json');
    if (!existsSync(path)) return null;
    return JSON.parse(await readFile(path, 'utf8')) as ScreenMeta;
  }

  /** The version numbers a screen has, ascending. Empty if the screen has no versions yet. */
  async listVersions(id: string): Promise<number[]> {
    const dir = join(this.root, id);
    if (!existsSync(dir)) return [];
    const files = await readdir(dir);
    return files
      .map((f) => /^(\d+)\.json$/.exec(f))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => Number(m[1]))
      .sort((a, b) => a - b);
  }

  /** Append a new immutable version of a screen's spec. Returns the new version number. */
  async saveVersion(id: string, spec: unknown): Promise<number> {
    if (!existsSync(join(this.root, id))) {
      throw new ScreenNotFoundError(`Screen "${id}" not found`);
    }
    // Structural validation only; catalog validation lands in #15.
    const parsed: Spec = SpecSchema.parse(spec);
    const versions = await this.listVersions(id);
    const next = (versions.at(-1) ?? 0) + 1;
    await writeFile(join(this.root, id, `${next}.json`), `${JSON.stringify(parsed, null, 2)}\n`);
    await this.commit(`Screen ${id} v${next}`);
    return next;
  }

  /** Fetch one version's spec, or null if the screen or version doesn't exist. */
  async getVersion(id: string, version: number): Promise<Spec | null> {
    const path = join(this.root, id, `${version}.json`);
    if (!existsSync(path)) return null;
    return SpecSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  }

  private async commit(message: string): Promise<void> {
    await this.git(['add', '-A']);
    await this.git(['commit', '--quiet', '-m', message]);
  }

  private async git(args: string[]): Promise<string> {
    const { stdout } = await exec('git', args, { cwd: this.root });
    return stdout;
  }
}

/** Thrown when a screen (or its version) isn't found. Routes map this to 404. */
export class ScreenNotFoundError extends Error {}
