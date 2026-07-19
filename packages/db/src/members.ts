import { and, eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { users, projectMembers, projectInvites, projects } from './schema.js';
import type { Project } from './projects.js';

/** A member's role in a project (#91). Owners invite members and mint/revoke machine tokens. */
export type Role = 'owner' | 'member';

/** The local mirror of a Supabase-Auth user. */
export interface User {
  id: string;
  email: string | null;
  createdAt: string;
}

/** A (project, user, role) membership. */
export interface Membership {
  projectId: string;
  userId: string;
  role: Role;
}

/**
 * Insert or update the local mirror of a Supabase user (id = JWT `sub`). Called on every
 * authenticated request so a user's email stays current without a separate sign-up step.
 */
export async function upsertUser(
  db: Db,
  input: { id: string; email?: string | null },
): Promise<User> {
  // Normalize email so invite matching and lookups are case-insensitive.
  const email = input.email ? input.email.trim().toLowerCase() : null;
  await db
    .insert(users)
    .values({ id: input.id, email })
    .onConflictDoUpdate({ target: users.id, set: { email } });
  const [row] = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
  return { id: row!.id, email: row!.email ?? null, createdAt: row!.createdAt };
}

/** The first user with this email, or null. Used to add an already-registered invitee immediately. */
export async function getUserByEmail(db: Db, email: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return row ? { id: row.id, email: row.email ?? null, createdAt: row.createdAt } : null;
}

/** Add a membership (or update its role if one already exists). */
export async function addMember(
  db: Db,
  projectId: string,
  userId: string,
  role: Role,
): Promise<Membership> {
  await db
    .insert(projectMembers)
    .values({ projectId, userId, role })
    .onConflictDoUpdate({
      target: [projectMembers.projectId, projectMembers.userId],
      set: { role },
    });
  return { projectId, userId, role };
}

/** The membership for (project, user), or null if the user is not a member. */
export async function getMembership(
  db: Db,
  projectId: string,
  userId: string,
): Promise<Membership | null> {
  const [row] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return row ? { projectId: row.projectId, userId: row.userId, role: row.role as Role } : null;
}

/** Every project a user belongs to, with their role in each. */
export async function listProjectsForUser(
  db: Db,
  userId: string,
): Promise<(Project & { role: Role })[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projectMembers.userId, userId));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    role: r.role as Role,
  }));
}

/** Every member of a project, with their email (for the member list UI). */
export async function listMembers(
  db: Db,
  projectId: string,
): Promise<(Membership & { email: string | null })[]> {
  const rows = await db
    .select({
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      role: projectMembers.role,
      email: users.email,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));
  return rows.map((r) => ({
    projectId: r.projectId,
    userId: r.userId,
    role: r.role as Role,
    email: r.email ?? null,
  }));
}

/** A pending invitation to a project. */
export interface Invite {
  projectId: string;
  email: string;
  role: Role;
}

/** Create or update a pending invite (by project + email). */
export async function createInvite(
  db: Db,
  projectId: string,
  email: string,
  role: Role,
): Promise<Invite> {
  const normalized = email.trim().toLowerCase();
  await db
    .insert(projectInvites)
    .values({ projectId, email: normalized, role })
    .onConflictDoUpdate({
      target: [projectInvites.projectId, projectInvites.email],
      set: { role },
    });
  return { projectId, email: normalized, role };
}

/** Pending invites for a project (for the members UI). */
export async function listInvites(db: Db, projectId: string): Promise<Invite[]> {
  const rows = await db
    .select()
    .from(projectInvites)
    .where(eq(projectInvites.projectId, projectId));
  return rows.map((r) => ({ projectId: r.projectId, email: r.email, role: r.role as Role }));
}

/**
 * Upsert a user on login and materialize any invites addressed to their email into real memberships.
 * Idempotent — safe to call on every authenticated request. This is how a magic-link user who was
 * invited before they had an account lands in the right projects on first sign-in.
 */
export async function syncUserOnLogin(
  db: Db,
  input: { id: string; email?: string | null },
): Promise<User> {
  const user = await upsertUser(db, input);
  if (!user.email) return user;
  const email = user.email.trim().toLowerCase();
  const invites = await db.select().from(projectInvites).where(eq(projectInvites.email, email));
  for (const inv of invites) {
    await addMember(db, inv.projectId, user.id, inv.role as Role);
    await db
      .delete(projectInvites)
      .where(and(eq(projectInvites.projectId, inv.projectId), eq(projectInvites.email, email)));
  }
  return user;
}
