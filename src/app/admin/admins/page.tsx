import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { members } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { isCreatorDiscordId } from "@/lib/permissions";
import { AdminsPanel } from "@/components/AdminsPanel";


// src/proxy.ts already keeps everyone but the CREATOR off this page —
// this is a second, defense-in-depth check, and it matters more than a
// usual page gate because this page *renders* the admin list. Checked
// against PORTAL_CREATOR_DISCORD_ID rather than the session's own
// isCreator flag, so the list can't be read by a session that merely
// claims to be the CREATOR. Mutations underneath are separately gated by
// requireCreator().
export default async function AdminsPage() {
  const session = await getServerSession(authOptions);
  if (!isCreatorDiscordId(session?.user?.discordId)) {
    redirect("/access-denied");
  }

  const admins = await db
    .select({
      id: members.id,
      robloxUsername: members.robloxUsername,
      discordUsername: members.discordUsername,
      rank: members.rank,
    })
    .from(members)
    .where(and(eq(members.isPortalAdmin, true), isNull(members.deletedAt)))
    .orderBy(asc(members.robloxUsername));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <nav className="mb-2 flex text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <ol className="flex items-center space-x-2">
            <li>Admin</li>
            <li>
              <svg fill="currentColor" viewBox="0 0 20 20" className="h-4 w-4 text-zinc-400" aria-hidden="true"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path></svg>
            </li>
            <li className="text-zinc-900 dark:text-zinc-100">Access</li>
          </ol>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">
          Admin Access
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Full portal access, independent of rank. Only visible to and
          editable by you, the server owner — nobody else, including other
          admins, can designate a new one. Search the roster to add
          someone, or remove access below.
        </p>
      </div>
      <AdminsPanel initialAdmins={admins} />
    </div>
  );
}
