import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAction } from "@/lib/permissions";
import {
  listPosts,
  suggestedVersions,
  unloggedCompletedReports,
} from "@/lib/changelog";
import { ChangelogManager } from "@/components/ChangelogManager";


/**
 * Where posts get written, edited and approved — the working side of the
 * change log, kept off the master page so that one stays a clean record.
 */
export default async function ChangelogManagePage() {
  const session = await getServerSession(authOptions);
  const live = session && !session.stale ? session : null;
  if (!live?.user || !hasAction(live.user, "changelog.write")) {
    redirect("/access-denied");
  }

  const [posts, versions, candidates] = await Promise.all([
    listPosts({ publishedOnly: false }),
    suggestedVersions(),
    unloggedCompletedReports(),
  ]);

  return (
    <ChangelogManager
      posts={posts.map((p) => ({
        id: p.id,
        title: p.title,
        version: p.version,
        status: p.status,
        entryCount: p.entryCount,
        publishedAt: p.publishedAt?.toISOString() ?? null,
      }))}
      versions={versions}
      candidates={candidates.map((c) => ({
        id: c.id,
        title: c.title,
        noteCount: c.notes.length,
      }))}
      canApprove={hasAction(live.user, "changelog.approve")}
    />
  );
}
