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
        <nav className="mb-2 flex text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <ol className="flex items-center space-x-2">
            <li>Admin</li>
            <li>
              <svg fill="currentColor" viewBox="0 0 20 20" className="h-4 w-4 text-zinc-400" aria-hidden="true"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"></path></svg>
            </li>
            <li className="text-zinc-900 dark:text-zinc-100">Bug Setup</li>
          </ol>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Bug Taxonomy Setup</h1>
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
