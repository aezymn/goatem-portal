import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { isCreatorDiscordId } from "@/lib/permissions";

// Shared chrome for every /admin/* page: a sidebar of sections. This is a
// UX convenience — src/proxy.ts already keeps non-admins out of /admin
// entirely, and "Admin Access" specifically out of anyone but the
// CREATOR, but the real enforcement is server-side on each API route
// (requireAdmin()/requireCreator() in src/lib/requireSession.ts).
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const isCreator = isCreatorDiscordId(session?.user?.discordId);

  const links = [
    { href: "/admin/ranks", label: "Ranks" },
    { href: "/admin/bug-setup", label: "Bug setup" },
    ...(isCreator ? [{ href: "/admin/admins", label: "Admin Access" }] : []),
    { href: "/admin/audit-log", label: "Audit Log" },
  ];

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
      <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto sm:w-44 sm:flex-col sm:overflow-visible">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
