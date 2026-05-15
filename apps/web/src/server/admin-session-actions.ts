import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE_NAME, adminCookieValue, getAdminApiKey } from '@/server/auth';

export async function requireAdminSession(): Promise<void> {
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
