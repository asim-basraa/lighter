import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { SpecSchema, type Spec } from '@lighter/spec';

const exec = promisify(execFile);

/** A screen: an addressable design surface that owns an ordered series of spec versions. */
export interface ScreenMeta {
  id: string;
  name: string;
}

const ScreenMetaSchema = z.object({ id: z.string(), name: z.string() });

/** Thrown when creating a screen whose id already exists. Routes map this to 409. */
export class ScreenExistsError extends Error {}

/** Thrown when a screen (or its version) isn't found. Routes map this to 404. */
export class ScreenNotFoundError extends Error {}

/** Thrown when duplicating a screen that has no spec version to copy. Routes map this to 422. */
export class ScreenEmptyError extends Error {}

/** Thrown when a screen name has no alphanumeric characters to slugify. Routes map this to 400. */
export class InvalidNameError extends Error {}

/**
 * A valid screen id: lowercase alphanumerics in dash-separated segments — exactly what `slugify`
 * produces. Ids arrive from the URL (`/screens/:id`), so this is the guard that keeps a crafted id
 * (`..`, `%2e%2e%2f…`, `.git`, an absolute path) from escaping the store root.
 */
const SCREEN_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidScreenId(id: string): boolean {
  return SCREEN_ID.test(id);
}

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
 *
 * Mutations are serialized per store instance (see `serialize`), so version numbering can't race and
 * concurrent commits can't collide on git's index lock. This assumes a single writing process; the
 * store is not safe for multiple processes writing the same `root` concurrently.
 */
export class SpecStore {
  /** Tail of the in-process mutation chain; used to serialize writes. */
  private mutations: Promise<unknown> = Promise.resolve();

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
      throw new InvalidNameError('Screen name must contain at least one alphanumeric character');
    }
    return this.serialize(async () => {
      const dir = join(this.root, id);
      if (existsSync(dir)) {
        throw new ScreenExistsError(`Screen "${id}" already exists`);
      }
      const meta: ScreenMeta = { id, name };
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'screen.json'), `${JSON.stringify(meta, null, 2)}\n`);
      await this.commit(`Create screen ${id}`);
      return meta;
    });
  }

  async listScreens(): Promise<ScreenMeta[]> {
    if (!existsSync(this.root)) return [];
    const entries = await readdir(this.root, { withFileTypes: true });
    const metas: ScreenMeta[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '.git') continue;
      // A corrupt screen.json must not take down the whole listing.
      const meta = await this.getScreen(entry.name);
      if (meta) metas.push(meta);
    }
    return metas.sort((a, b) => a.id.localeCompare(b.id));
  }

  async getScreen(id: string): Promise<ScreenMeta | null> {
    if (!isValidScreenId(id)) return null;
    const path = join(this.root, id, 'screen.json');
    if (!existsSync(path)) return null;
    try {
      return ScreenMetaSchema.parse(JSON.parse(await readFile(path, 'utf8')));
    } catch {
      return null; // unreadable / malformed metadata → treat as absent
    }
  }

  /** The version numbers a screen has, ascending. Empty if the screen has no versions yet. */
  async listVersions(id: string): Promise<number[]> {
    if (!isValidScreenId(id)) return [];
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
    // Structural validation only (catalog validation lands in #15). Done before serializing so a bad
    // spec fails fast without holding the mutation lock.
    const parsed: Spec = SpecSchema.parse(spec);
    return this.serialize(async () => {
      if (!isValidScreenId(id) || !existsSync(join(this.root, id))) {
        throw new ScreenNotFoundError(`Screen "${id}" not found`);
      }
      const versions = await this.listVersions(id);
      const next = (versions.at(-1) ?? 0) + 1;
      // `wx` = exclusive create: never clobber an existing version file.
      await writeFile(join(this.root, id, `${next}.json`), `${JSON.stringify(parsed, null, 2)}\n`, {
        flag: 'wx',
      });
      await this.commit(`Screen ${id} v${next}`);
      return next;
    });
  }

  /**
   * Duplicate an existing screen: create a new screen whose v1 is a faithful copy of the source's
   * latest spec. The copy is byte-for-byte (no catalog re-validation) — it clones already-stored,
   * already-valid data — and the source is only read, so it's untouched. One atomic commit.
   */
  async duplicateScreen(
    sourceId: string,
    newName: string,
  ): Promise<{ screen: ScreenMeta; version: 1 }> {
    const newId = slugify(newName);
    if (newId.length === 0) {
      throw new InvalidNameError('Screen name must contain at least one alphanumeric character');
    }
    return this.serialize(async () => {
      if (!isValidScreenId(sourceId) || !existsSync(join(this.root, sourceId))) {
        throw new ScreenNotFoundError(`Screen "${sourceId}" not found`);
      }
      const latest = (await this.listVersions(sourceId)).at(-1);
      if (latest === undefined) {
        throw new ScreenEmptyError(`Screen "${sourceId}" has no spec version to duplicate`);
      }
      const newDir = join(this.root, newId);
      if (existsSync(newDir)) {
        throw new ScreenExistsError(`Screen "${newId}" already exists`);
      }
      const sourceSpec = await readFile(join(this.root, sourceId, `${latest}.json`), 'utf8');
      const meta: ScreenMeta = { id: newId, name: newName };
      await mkdir(newDir, { recursive: true });
      await writeFile(join(newDir, 'screen.json'), `${JSON.stringify(meta, null, 2)}\n`);
      await writeFile(join(newDir, '1.json'), sourceSpec, { flag: 'wx' });
      await this.commit(`Duplicate screen ${sourceId} → ${newId} (from v${latest})`);
      return { screen: meta, version: 1 };
    });
  }

  /** Fetch one version's spec, or null if the screen/version doesn't exist or the file is corrupt. */
  async getVersion(id: string, version: number): Promise<Spec | null> {
    if (!isValidScreenId(id)) return null;
    const path = join(this.root, id, `${version}.json`);
    if (!existsSync(path)) return null;
    try {
      return SpecSchema.parse(JSON.parse(await readFile(path, 'utf8')));
    } catch {
      return null; // corrupt/unparseable version file → treat as absent (matches getScreen)
    }
  }

  /**
   * Read a screen's INTENT.md (purpose, flows, edge states, mocked data), or null if the screen or
   * the file doesn't exist. It lives in the screen's git dir, so it versions and exports with the
   * screen (#32).
   */
  async getIntent(id: string): Promise<string | null> {
    if (!isValidScreenId(id)) return null;
    const path = join(this.root, id, 'INTENT.md');
    if (!existsSync(path)) return null;
    try {
      return await readFile(path, 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * Create or replace a screen's INTENT.md and commit it. Unlike a spec version, INTENT.md is mutable
   * (authored and re-edited), so it's overwritten in place — git keeps the history. Throws
   * ScreenNotFoundError if the screen doesn't exist.
   */
  async setIntent(id: string, content: string): Promise<void> {
    return this.serialize(async () => {
      if (!isValidScreenId(id) || !existsSync(join(this.root, id))) {
        throw new ScreenNotFoundError(`Screen "${id}" not found`);
      }
      await writeFile(join(this.root, id, 'INTENT.md'), content);
      await this.commit(`Screen ${id} INTENT.md`);
    });
  }

  /** Run a mutation exclusively, after any in-flight mutation on this store completes. */
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.mutations.then(fn, fn);
    this.mutations = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
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
