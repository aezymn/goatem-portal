import { listCategories, listTags } from "@/lib/bugTaxonomy";
import { BugTaxonomyBoard } from "@/components/BugTaxonomyBoard";

export const dynamic = "force-dynamic";

export default async function BugSetupPage() {
  const [categories, tags] = await Promise.all([listCategories(), listTags()]);

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
      <BugTaxonomyBoard kind="tags" entries={tags} />
    </div>
  );
}
