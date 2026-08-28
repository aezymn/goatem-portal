import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";

// Explicit rather than relying on getServerSession's cookie read to be
// inferred as dynamic — see src/app/reports/page.tsx for why this matters.

export default async function Home() {
  const session = await getServerSession(authOptions);
  const authed = session && !session.stale;

  if (!authed) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Quality Assurance
        </h1>
        <p className="max-w-lg text-zinc-600 dark:text-zinc-400">
          Sign in with the Discord account you use in the Goatem Studios
          server to view the roster and bug tracker. Access is checked
          against your current server membership and roles every time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome back, {session.user.name}
      </h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/reports"
          className="rounded-lg border border-zinc-200 p-5 hover:border-indigo-400 dark:border-zinc-800"
        >
          <h2 className="font-medium">Bug Reports</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            File a bug report, or check the status of one already in
            progress.
          </p>
        </Link>
        <Link
          href="/roster"
          className="rounded-lg border border-zinc-200 p-5 hover:border-indigo-400 dark:border-zinc-800"
        >
          <h2 className="font-medium">Roster</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Current staff, ranks, and status.
          </p>
        </Link>
        {(session.user.isCreator || session.user.isPortalAdmin) && (
          <Link
            href="/admin/audit-log"
            className="rounded-lg border border-zinc-200 p-5 hover:border-indigo-400 dark:border-zinc-800"
          >
            <h2 className="font-medium">Audit Log</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Every sensitive action taken in the portal — read-only, admin
              only.
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}
