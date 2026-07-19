'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PROJECT_COOKIE } from '../../lib/session.js';
import { createProjectApi } from '../../lib/projects.js';

/** Select the active project (stores the cookie the fetchers read) and return to the dashboard. */
export async function selectProjectAction(formData: FormData) {
  const projectId = String(formData.get('projectId') ?? '');
  if (projectId) {
    cookies().set(PROJECT_COOKIE, projectId, { httpOnly: true, sameSite: 'lax', path: '/' });
  }
  redirect('/');
}

/** Create a project, select it, and go to the dashboard. Re-renders `/projects` with an error on failure. */
export async function createProjectAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/projects?error=' + encodeURIComponent('Enter a project name'));
  const result = await createProjectApi(name);
  if ('error' in result) redirect('/projects?error=' + encodeURIComponent(result.error));
  cookies().set(PROJECT_COOKIE, result.id, { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/');
}
