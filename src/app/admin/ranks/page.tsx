import { listRanksWithActions } from "@/lib/ranks";
import { listGuildRoles } from "@/lib/discordBot";
import { RanksBoard } from "@/components/RanksBoard";

// Direct DB/bot reads aren't auto-detected as dynamic — force it, same as
// every other data-driven page in this app.
export const dynamic = "force-dynamic";

export default async function RanksPage() {
  const [ranks, discordRoles] = await Promise.all([
    listRanksWithActions(),
    listGuildRoles(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ranks</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Drag ranks to set their authority order, optionally bind each to a
          Discord role, and choose exactly what each rank is allowed to do.
          A rank granted nothing here still gets the baseline every roster
          member has — view the roster, file/view/comment on bug reports —
          just nothing more. Full admin access is handled separately, on
          the Admin Access page, and is never something a rank can grant.
        </p>
      </div>
      <RanksBoard initialRanks={ranks} discordRoles={discordRoles} />
    </div>
  );
}
