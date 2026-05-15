import Link from 'next/link';
import { loginAdminAction } from '@/server/admin-session-actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Admin login</h1>
      <p className="mt-2 text-sm text-slate-400">
        Enter the server <code className="text-slate-200">ADMIN_API_KEY</code> value. The session
        cookie is httpOnly.
      </p>
      <form action={loginAdminAction} className="mt-6 space-y-4">
        <label className="block text-sm text-slate-300">
          Admin password
          <input
            className="mt-2 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
            name="password"
            type="password"
            autoComplete="off"
            required
          />
        </label>
        {error === '1' ? <p className="text-sm text-red-400">Invalid password.</p> : null}
        {error === 'config' ? (
          <p className="text-sm text-red-400">ADMIN_API_KEY is not configured on the server.</p>
        ) : null}
        <button
          className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
          type="submit"
        >
          Sign in
        </button>
      </form>
      <p className="mt-6 text-xs text-slate-500">
        <Link className="underline" href="/">
          Home
        </Link>
      </p>
    </div>
  );
}
