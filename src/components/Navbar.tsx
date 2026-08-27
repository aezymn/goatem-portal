"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Me {
  robloxUsername: string | null;
  rank: string | null;
  avatarUrl: string | null;
  roleColorHex: string | null;
}

export function Navbar() {
  const { data: session, status } = useSession();
  const authed = status === "authenticated" && !session?.stale;
  const isAdmin = authed && (session.user.isCreator || session.user.isPortalAdmin);

  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    // UserChip only ever renders while authed, so there's nothing to reset
    // here when signed out — just skip fetching. Next sign-in re-runs this
    // and overwrites `me` with fresh data before it's rendered again.
    if (!authed) return;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, [authed]);

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
              {isAdmin && (
                <Link href="/admin/ranks" className="hover:underline">
                  Admin
                </Link>
              )}
            </>
          )}

          {status === "loading" ? null : authed ? (
            <UserChip session={session} me={me} />
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

function UserChip({
  session,
  me,
}: {
  session: NonNullable<ReturnType<typeof useSession>["data"]>;
  me: Me | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const displayName = me?.robloxUsername ?? session.user.name ?? "Signed in";
  // Deliberately the roster's organization rank, not what the person can
  // actually DO (permissions) — that's a separate concept, see
  // src/lib/permissions.ts. Not on the roster yet still gets a badge, just
  // an honest one.
  const rankLabel = me?.rank ?? "Not on roster yet";

  return (
    <div className="flex items-center gap-1.5">
      {session.user.isCreator && (
        <span className="whitespace-nowrap rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          Creator
        </span>
      )}

      <span
        className="whitespace-nowrap rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
        style={{ color: me?.roleColorHex ?? undefined }}
      >
        {rankLabel}
      </span>

      {/* The main pill: avatar, name, and the settings control all inside
          one shape, rather than settings living as a separate button. */}
      <div className="relative" ref={menuRef}>
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 py-1 pl-1 pr-1 dark:border-zinc-800 dark:bg-zinc-900">
          {me?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, bot-sourced Discord CDN avatar
            <img
              src={me.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-zinc-300 dark:bg-zinc-700" />
          )}
          <span className="pr-1 font-medium">{displayName}</span>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Settings"
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="absolute right-0 top-11 z-10 w-40 rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <button
              onClick={() => signOut()}
              className="block w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
