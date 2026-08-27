"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function Navbar() {
  const { data: session, status } = useSession();
  const authed = status === "authenticated" && !session?.stale;

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          Goatem Studios Portal
        </Link>

        <div className="flex items-center gap-6 text-sm">
          {authed && (
            <>
              <Link href="/reports" className="hover:underline">
                Bug Reports
              </Link>
              <Link href="/roster" className="hover:underline">
                Roster
              </Link>
              {session.user.permissionTier === "ADMIN" && (
                <Link href="/admin/audit-log" className="hover:underline">
                  Audit Log
                </Link>
              )}
            </>
          )}

          {status === "loading" ? null : authed ? (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {session.user.permissionTier}
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("discord")}
              className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500"
            >
              Sign in with Discord
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
