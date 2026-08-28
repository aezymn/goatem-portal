import { listCategories, listTags } from "@/lib/bugTaxonomy";
import { NewReportForm } from "@/components/NewReportForm";

// The category and tag lists come from the database, so this can't be
// prerendered at build time.

export default async function NewReportPage() {
  const [categories, tags] = await Promise.all([listCategories(), listTags()]);
  return <NewReportForm categories={categories} tags={tags} />;
}
