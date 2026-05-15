import { importCursorUsageJson } from '@/server/cursor-usage-import';
import { performCursorUsageSync } from '@/server/cursor-usage-sync';
import { getPrisma } from '@/server/db';
import { runMatchingPass } from '@/server/matching/runMatching';
import { redirect } from 'next/navigation';
import { requireAdminSession } from '@/server/admin-session-actions';

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
    await runMatchingPass(getPrisma());
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
    const prisma = getPrisma();
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
