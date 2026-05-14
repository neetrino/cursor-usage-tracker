import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE_NAME, adminCookieValue } from '@/server/auth';
import { logoutAdminAction } from '@/server/dashboard-actions';

export default async function SecureDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value ?? '';
  const expected = adminCookieValue();
  if (!expected || token !== expected) {
    redirect('/dashboard/login');
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <nav className="flex flex-wrap gap-4 text-sm">
            <Link className="text-slate-300 hover:text-white" href="/dashboard">
              Summary
            </Link>
            <Link className="text-slate-300 hover:text-white" href="/dashboard/events">
              Usage events
            </Link>
            <Link className="text-slate-300 hover:text-white" href="/dashboard/local-events">
              Local events
            </Link>
            <Link className="text-slate-300 hover:text-white" href="/dashboard/settings">
              Settings
            </Link>
          </nav>
          <form action={logoutAdminAction}>
            <button className="text-sm text-slate-400 hover:text-white" type="submit">
              Logout
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
