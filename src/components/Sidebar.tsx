"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Me {
  robloxUsername: string | null;
  rank: string | null;
  avatarUrl: string | null;
  roleColorHex: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

// Icons are inline rather than a dependency: six small paths don't justify
// pulling in an icon library, and inlining means no extra request.
const icon = (d: string) => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4 shrink-0"
  >
    <path d={d} />
  </svg>
);

const MAIN_NAV: NavItem[] = [
  { href: "/reports", label: "Bug Reports", icon: icon("M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z") },
  { href: "/roster", label: "Roster", icon: icon("M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75") },
  { href: "/absence", label: "Report Absence", icon: icon("M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z") },
  { href: "/testing", label: "Report Testing", icon: icon("M9 2v6L4.6 16.4A2 2 0 0 0 6.3 19.5h11.4a2 2 0 0 0 1.7-3.1L15 8V2M9 2h6M7.5 14h9") },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/ranks", label: "Ranks", icon: icon("M4 20V10M12 20V4M20 20v-6") },
  { href: "/admin/admins", label: "Admin Access", icon: icon("M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z") },
  { href: "/admin/audit-log", label: "Audit Log", icon: icon("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6") },
];

export function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const authed = status === "authenticated" && !session?.stale;
  const isCreator = authed && session.user.isCreator;
  const isAdmin = authed && (session.user.isCreator || session.user.isPortalAdmin);

  const [me, setMe] = useState<Me | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!authed) return;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, [authed]);

  // Close the mobile drawer whenever navigation happens, so following a
  // link doesn't leave the overlay covering the page you just opened.
  // Adjusted during render rather than in an effect: React re-runs this
  // component immediately with the corrected state, so the drawer never
  // paints open over the new route.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  // Admin Access is CREATOR-only (see src/lib/permissions.ts), so it isn't
  // even listed for a portal admin who could never open it.
  const adminItems = ADMIN_NAV.filter(
    (item) => isCreator || item.href !== "/admin/admins"
  );

  return (
    <>
      {/* Mobile: a slim bar with the mark and a menu toggle. The sidebar
          itself becomes an overlay rather than squeezing the content. */}
      <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
          className="rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Brand />
      </div>

      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white transition-transform md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-950`}
      >
        <div className="hidden px-4 py-4 md:block">
          <Brand />
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4 md:py-2">
          {authed ? (
            <>
              <Section items={MAIN_NAV} pathname={pathname} />
              {isAdmin && adminItems.length > 0 && (
                <Section
                  heading="Admin"
                  items={adminItems}
                  pathname={pathname}
                />
              )}
            </>
          ) : (
            <p className="px-2 text-sm text-zinc-500">
              Sign in to see the roster and bug tracker.
            </p>
          )}
        </nav>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          {status === "loading" ? null : authed ? (
            <UserChip session={session} me={me} />
          ) : (
            <button
              onClick={() => signIn("discord")}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Sign in with Discord
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- static local asset */}
      <img
        src="/goatem-logo.png"
        alt=""
        className="h-9 w-auto invert dark:invert-0"
      />
      <span className="text-lg font-semibold tracking-tight">
        Quality Assurance
      </span>
    </Link>
  );
}

function Section({
  heading,
  items,
  pathname,
}: {
  heading?: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {heading && (
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {heading}
        </p>
      )}
      {items.map((item) => {
        // Exact match, or a nested route beneath it — so /reports/new
        // still highlights Bug Reports.
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition ${
              active
                ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900/60 dark:hover:text-zinc-100"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </div>
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
  // The roster's organisation rank, not the permission model — see
  // src/lib/permissions.ts for why those are separate things.
  const rankLabel = me?.rank ?? "Not on roster yet";

  return (
    <div className="relative" ref={menuRef}>
      {menuOpen && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-full rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <button
            onClick={() => signOut()}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      )}

      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        {me?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- bot-sourced Discord CDN avatar
          <img
            src={me.avatarUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-9 w-9 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        )}

        <span className="flex min-w-0 flex-col gap-0.5 leading-none">
          <span className="truncate text-sm">{displayName}</span>
          <span className="flex items-center gap-1">
            {session.user.isCreator && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                Creator
              </span>
            )}
            <span
              className="truncate rounded-full bg-zinc-200 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              style={{ color: me?.roleColorHex ?? undefined }}
            >
              {rankLabel}
            </span>
          </span>
        </span>

        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="ml-auto h-4 w-4 shrink-0 text-zinc-400"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
    </div>
  );
}
