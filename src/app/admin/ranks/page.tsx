import { getCachedRanks } from "@/lib/ranks";
import { listGuildRoles } from "@/lib/discordBot";
import { RanksBoard } from "@/components/RanksBoard";

// Direct DB/bot reads aren't auto-detected as dynamic — force it, same as
// every other data-driven page in this app.

export default async function RanksPage() {
  const [ranks, discordRoles] = await Promise.all([
    getCachedRanks(),
    listGuildRoles(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ranks</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Drag to set authority order, click a name to rename it. Binding
          a Discord role is what puts people on the roster at that rank.
        </p>
        <details className="group mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          <summary className="cursor-pointer select-none text-xs uppercase tracking-wide text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            What the permissions mean
          </summary>
          <p className="mt-2">
            Every roster member can view the roster and file, read and
            comment on bug reports regardless of rank — the pills below
            grant things <em>beyond</em> that, so a rank with none ticked
            still isn&apos;t useless. Full admin access isn&apos;t here on
            purpose: it lives on the Admin Access page and is never
            something a rank can confer.
          </p>
        </details>
      </div>
      <RanksBoard initialRanks={ranks} discordRoles={discordRoles} />
    </div>
  );
}
