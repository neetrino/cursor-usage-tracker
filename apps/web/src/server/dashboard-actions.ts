import { importCursorUsageJson } from '@/server/cursor-usage-import';
import { performCursorUsageSync } from '@/server/cursor-usage-sync';
import { prisma } from '@/server/db';
import { runMatchingPass } from '@/server/matching/runMatching';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE_NAME, adminCookieValue, getAdminApiKey } from '@/server/auth';

async function requireAdminSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value ?? '';
  const expected = adminCookieValue();
  if (!expected || token !== expected) {
    redirect('/dashboard/login');
  }
}

export async function loginAdminAction(formData: FormData): Promise<void> {
  'use server';
  const expected = getAdminApiKey();
  if (!expected) {
    redirect('/dashboard/login?error=config');
  }
  const password = String(formData.get('password') ?? '');
  if (password !== expected) {
    redirect('/dashboard/login?error=1');
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE_NAME, adminCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  redirect('/dashboard');
}

export async function logoutAdminAction(): Promise<void> {
  'use server';
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE_NAME);
  redirect('/dashboard/login');
}

export async function syncCursorUsageNowAction(): Promise<void> {
  'use server';
  await requireAdminSession();
  try {
    await performCursorUsageSync();
    redirect('/dashboard/settings?synced=1');
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    redirect(`/dashboard/settings?syncError=${encodeURIComponent(message)}`);
  }
}

export async function runMatchingNowAction(): Promise<void> {
  'use server';
  await requireAdminSession();
  try {
    await runMatchingPass(prisma);
    redirect('/dashboard/settings?matched=1');
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    redirect(`/dashboard/settings?matchError=${encodeURIComponent(message)}`);
  }
}

export async function importCursorUsageJsonAction(formData: FormData): Promise<void> {
  'use server';
  await requireAdminSession();
  const text = String(formData.get('json') ?? '');
  try {
    const parsed: unknown = JSON.parse(text);
    await importCursorUsageJson({
      prisma,
      rawBody: parsed,
      source: 'manual_import',
      runMatch: true,
    });
    redirect('/dashboard/settings?imported=1');
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    redirect(`/dashboard/settings?importError=${encodeURIComponent(message)}`);
  }
}
