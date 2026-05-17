import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE_NAME, adminCookieValue } from '@/server/auth';
import { logoutAdminAction } from '@/server/admin-session-actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function TopBar() {
  const nav = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/events', label: 'Events' },
    { href: '/dashboard/settings', label: 'Settings' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#1f1f1f] bg-[#0a0a0a]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <Link className="flex shrink-0 items-center gap-2" href="/dashboard">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#6366f1] text-xs font-bold text-white">
            C
          </span>
          <span className="hidden text-sm font-medium text-[#e5e5e5] sm:inline">Usage Tracker</span>
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-1">
          {nav.map((item) => (
            <NavLink href={item.href} key={item.href} label={item.label} />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1f1f1f] bg-[#111111] text-xs font-medium text-[#666]"
            title="Admin"
          >
            A
          </span>
          <form action={logoutAdminAction}>
            <button
              className="text-xs text-[#666] transition-colors hover:text-[#e5e5e5]"
              type="submit"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="rounded-xl px-3 py-1.5 text-sm text-[#666] transition-colors hover:bg-[#111111] hover:text-[#e5e5e5]"
      href={href}
    >
      {label}
    </Link>
  );
}

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
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
