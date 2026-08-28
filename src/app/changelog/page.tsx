import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAction } from "@/lib/permissions";
import { listEntries, listPosts } from "@/lib/changelog";


/**
 * The master change log: everything that has shipped, newest first.
 *
 * Read-only by design. Composing and approving happen on the manage page
 * so this one stays what people are actually here for — a clean record of
 * what changed and when.
 */
export default async function ChangelogPage() {
  const session = await getServerSession(authOptions);
  const live = session && !session.stale ? session : null;
  if (!live?.user || !hasAction(live.user, "changelog.view")) {
    redirect("/access-denied");
  }

  const posts = await listPosts({ publishedOnly: true });
  const entries = await Promise.all(posts.map((p) => listEntries(p.id)));
  const canWrite = hasAction(live.user, "changelog.write");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Change Log</h1>
          <p className="mt-1 text-sm text-zinc-500">
            What&apos;s shipped, newest first.
          </p>
        </div>
        {canWrite && (
          <Link
            href="/changelog/manage"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Manage posts
          </Link>
        )}
      </div>

      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Nothing published yet.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-8">
          {/* The same vertical line the bug threads use, so a release
              history and a bug history read as the same kind of thing. */}
          <span
            aria-hidden
            className="absolute bottom-2 left-[7px] top-3 w-px bg-zinc-200 dark:bg-zinc-800"
          />

          {posts.map((post, i) => (
            <li key={post.id} className="relative pl-7">
              <span
                aria-hidden
                className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full bg-indigo-500 ring-4 ring-zinc-50 dark:ring-black"
              />

              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="rounded-md bg-zinc-900 px-2 py-0.5 font-mono text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  v{post.version}
                </span>
                <h2 className="text-lg font-semibold tracking-tight">
                  {post.title}
                </h2>
                <span className="text-xs text-zinc-400">
                  {(post.publishedAt ?? post.createdAt).toLocaleDateString(
                    undefined,
                    { day: "numeric", month: "long", year: "numeric" }
                  )}
                </span>
              </div>

              {post.body && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                  {post.body}
                </p>
              )}

              {entries[i].length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {entries[i].map((entry) => (
                    <li
                      key={entry.id}
                      className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                    >
                      <span aria-hidden className="select-none text-zinc-400">
                        •
                      </span>
                      <span className="min-w-0">
                        {entry.text}
                        {entry.bugReportId && (
                          <Link
                            href={`/reports/${entry.bugReportId}`}
                            className="ml-1.5 whitespace-nowrap text-xs text-zinc-400 hover:underline"
                          >
                            #report
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
