import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAction } from "@/lib/permissions";
import { getPost, listEntries, unloggedCompletedReports } from "@/lib/changelog";
import { ChangelogPostEditor } from "@/components/ChangelogPostEditor";


export default async function EditChangelogPostPage({
  params,
}: PageProps<"/changelog/manage/[id]">) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const live = session && !session.stale ? session : null;
  if (!live?.user || !hasAction(live.user, "changelog.write")) {
    redirect("/access-denied");
  }

  const post = await getPost(id);
  if (!post) notFound();

  const [entries, candidates] = await Promise.all([
    listEntries(id),
    unloggedCompletedReports(),
  ]);

  return (
    <ChangelogPostEditor
      post={{
        id: post.id,
        title: post.title,
        version: post.version,
        body: post.body,
        status: post.status,
        publishedAt: post.publishedAt?.toISOString() ?? null,
      }}
      entries={entries}
      candidates={candidates.map((c) => ({
        id: c.id,
        title: c.title,
        noteCount: c.notes.length,
      }))}
      canApprove={hasAction(live.user, "changelog.approve")}
    />
  );
}
