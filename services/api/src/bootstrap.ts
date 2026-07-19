import { getProject, createProject, mintToken, type Db, type Project } from '@lighter/db';

export interface BootstrapResult {
  created: boolean;
  project: Project;
  /** The raw API token — present only when the project was just created (shown once). */
  token?: string;
}

/** Local slug (mirrors the db layer) so we can look up before creating. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Seed a project + its first API token on boot when `LIGHTER_BOOTSTRAP_PROJECT` is set — so a fresh
 * cloud deployment is immediately usable by the CLI without a token-mint endpoint (#87). Idempotent:
 * if the project already exists it's returned without minting a new token, so a redeploy/restart never
 * rotates the credential. The raw token is returned (and logged once by the caller) only on first
 * creation.
 */
export async function bootstrapProject(
  db: Db,
  projectName: string,
  tokenSecret?: string,
): Promise<BootstrapResult> {
  const id = slugify(projectName);
  if (!id) throw new Error('LIGHTER_BOOTSTRAP_PROJECT has no slug-able characters');
  const existing = await getProject(db, id);
  if (existing) return { created: false, project: existing };
  const project = await createProject(db, { name: projectName, id });
  const { token } = await mintToken(db, id, { label: 'bootstrap', secret: tokenSecret });
  return { created: true, project, token };
}
