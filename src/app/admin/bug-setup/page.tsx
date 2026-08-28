import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAction } from "@/lib/permissions";
import {
  listCategories,
  listTagGroups,
  listTags,
} from "@/lib/bugTaxonomy";
import { BugTaxonomyBoard } from "@/components/BugTaxonomyBoard";

export const dynamic = "force-dynamic";

export default async function BugSetupPage() {
  // Managing these is a rank-grantable action now, not admin-only — so
  // the page checks the action itself rather than relying on /admin's
  // blanket gate, which would otherwise keep out a rank that has it.
  const session = await getServerSession(authOptions);
  const live = session && !session.stale ? session : null;
  if (!live?.user || !hasAction(live.user, "bugsetup.manage")) {
    redirect("/access-denied");
  }

  const [categories, groups, tags] = await Promise.all([
    listCategories(),
    listTagGroups(),
    listTags(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bug setup</h1>
        <p className="mt-1 text-sm text-zinc-500">
          The lists everyone picks from when filing and triaging. Kept here
          rather than editable on the fly, so the same idea doesn&apos;t end
          up as three near-identical tags.
        </p>
      </div>

      <BugTaxonomyBoard kind="categories" entries={categories} />
      <BugTaxonomyBoard kind="groups" entries={groups} />
      <BugTaxonomyBoard kind="tags" entries={tags} groups={groups} />
    </div>
  );
}
