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

import {
  Bug,
  Users,
  CalendarOff,
  FlaskConical,
  ScrollText,
  ShieldAlert,
  Settings,
  UserCog,
  History,
  FileClock,
  Menu,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const MAIN_NAV: NavItem[] = [
  { href: "/reports", label: "Bug Reports", icon: <Bug className="h-4 w-4 shrink-0" /> },
  { href: "/roster", label: "Roster", icon: <Users className="h-4 w-4 shrink-0" /> },
  { href: "/absence", label: "Report Absence", icon: <CalendarOff className="h-4 w-4 shrink-0" /> },
  { href: "/testing", label: "Report Testing", icon: <FlaskConical className="h-4 w-4 shrink-0" /> },
  { href: "/changelog", label: "Change Log", icon: <ScrollText className="h-4 w-4 shrink-0" /> },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin/ranks", label: "Ranks", icon: <ShieldAlert className="h-4 w-4 shrink-0" /> },
  { href: "/admin/bug-setup", label: "Bug setup", icon: <Settings className="h-4 w-4 shrink-0" /> },
  { href: "/admin/admins", label: "Admin Access", icon: <UserCog className="h-4 w-4 shrink-0" /> },
  { href: "/changelog/manage", label: "Change log posts", icon: <History className="h-4 w-4 shrink-0" /> },
  { href: "/admin/audit-log", label: "Audit Log", icon: <FileClock className="h-4 w-4 shrink-0" /> },
];

export function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const authed = status === "authenticated" && !session?.stale;
  const isCreator = authed && session.user.isCreator;
  const isAdmin = authed && (session.user.isCreator || session.user.isPortalAdmin);
  const actions = authed ? (session.user.actions ?? []) : [];
  const canBugSetup = isAdmin || actions.includes("bugsetup.manage");
  const canSeeChangelog = isAdmin || actions.includes("changelog.view");
  const canWriteChangelog = isAdmin || actions.includes("changelog.write");

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
  const adminItems = ADMIN_NAV.filter((item) => {
    if (item.href === "/admin/admins") return isCreator;
    // Bug setup is grantable by rank, so someone who holds that action
    // sees it here even though the rest of Admin isn't theirs.
    if (item.href === "/admin/bug-setup") return canBugSetup;
    if (item.href === "/changelog/manage") return canWriteChangelog;
    return isAdmin;
  });

  return (
    <>
      {/* Mobile: a slim bar with the mark and a menu toggle. The sidebar
          itself becomes an overlay rather than squeezing the content. */}
      <div className="glass flex items-center gap-3 border-b border-zinc-200/50 px-4 py-3 md:hidden dark:border-zinc-800/50">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={mobileOpen}
          className="rounded-md p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          <Menu className="h-5 w-5" />
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
        } glass fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-zinc-200/50 transition-transform md:translate-x-0 dark:border-zinc-800/50`}
      >
        <div className="hidden px-4 py-4 md:block">
          <Brand />
        </div>

        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4 md:py-2">
          {authed ? (
            <>
              <Section
                items={MAIN_NAV.filter(
                  (item) =>
                    item.href !== "/changelog" || canSeeChangelog
                )}
                pathname={pathname}
              />
              {adminItems.length > 0 && (
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

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, ChevronsUpDown } from "lucide-react";

function UserChip({
  session,
  me,
}: {
  session: NonNullable<ReturnType<typeof useSession>["data"]>;
  me: Me | null;
}) {
  const displayName = me?.robloxUsername ?? session.user.name ?? "Signed in";
  const rankLabel = me?.rank ?? "Not on roster yet";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-zinc-900">
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
            <span className="truncate text-sm font-medium">{displayName}</span>
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

          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-zinc-400" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          side="top"
          sideOffset={8}
          className="z-50 min-w-[240px] overflow-hidden rounded-lg border border-zinc-200 bg-white p-1 shadow-lg animate-in fade-in zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <DropdownMenu.Item
            onSelect={() => signOut()}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 outline-none hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 dark:focus:bg-red-950/50"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
