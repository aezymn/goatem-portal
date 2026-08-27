import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { members } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { AdminsPanel } from "@/components/AdminsPanel";

export const dynamic = "force-dynamic";

// src/proxy.ts already keeps everyone but the CREATOR off this page —
// this is a second, defense-in-depth check. The actual security boundary
// is requireCreator() on every route under /api/admin/admins.
export default async function AdminsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isCreator) {
    redirect("/access-denied");
  }

  const admins = await db
    .select()
    .from(members)
    .where(and(eq(members.isPortalAdmin, true), isNull(members.deletedAt)))
    .orderBy(asc(members.robloxUsername));

  return (
    <div className="flex flex-col gap-6">
      <div>
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
