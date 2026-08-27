import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { bugReports, comments, members } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { hasAction } from "@/lib/permissions";
import { displayNameFor } from "@/lib/members";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportActions } from "@/components/ReportActions";
import { CommentForm } from "@/components/CommentForm";

const assigneeAlias = alias(members, "assignee");

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const [report] = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      description: bugReports.description,
      status: bugReports.status,
      createdAt: bugReports.createdAt,
      reporterUsername: members.robloxUsername,
      assigneeId: bugReports.assigneeId,
      assigneeUsername: assigneeAlias.robloxUsername,
    })
    .from(bugReports)
    .innerJoin(members, eq(bugReports.reporterId, members.id))
    .leftJoin(assigneeAlias, eq(bugReports.assigneeId, assigneeAlias.id))
    .where(and(eq(bugReports.id, id), isNull(bugReports.deletedAt)))
    .limit(1);

  if (!report) notFound();

  const reportComments = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorUsername: members.robloxUsername,
    })
    .from(comments)
    .innerJoin(members, eq(comments.authorId, members.id))
    .where(and(eq(comments.bugReportId, id), isNull(comments.deletedAt)))
    .orderBy(asc(comments.createdAt));

  const canTriage = session?.user ? hasAction(session.user, "reports.triage") : false;
  const canDelete = session?.user ? hasAction(session.user, "reports.delete") : false;

  const staffOptions = canTriage
    ? await db
        .select({
          id: members.id,
          robloxUsername: members.robloxUsername,
          discordUsername: members.discordUsername,
          discordId: members.discordId,
        })
        .from(members)
        .where(isNull(members.deletedAt))
    : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <StatusBadge status={report.status} />
          <span className="text-xs text-zinc-500">
            filed by {report.reporterUsername} on{" "}
            {report.createdAt.toLocaleDateString()}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {report.title}
        </h1>
        <p className="mt-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
          {report.description}
        </p>
        {report.assigneeUsername && (
          <p className="mt-3 text-sm text-zinc-500">
            Assigned to {report.assigneeUsername}
          </p>
        )}
      </div>

      {(canTriage || canDelete) && (
        <ReportActions
          reportId={report.id}
          currentStatus={report.status}
          currentAssigneeId={report.assigneeId}
          canTriage={canTriage}
          canDelete={canDelete}
          members={staffOptions.map((m) => ({ id: m.id, name: displayNameFor(m) }))}
        />
      )}

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="mb-4 font-medium">
          Comments ({reportComments.length})
        </h2>
        <ul className="flex flex-col gap-4">
          {reportComments.map((c) => (
            <li key={c.id} className="text-sm">
              <p className="font-medium">
                {c.authorUsername}{" "}
                <span className="font-normal text-zinc-500">
                  {c.createdAt.toLocaleString()}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <CommentForm reportId={report.id} />
        </div>
      </div>
    </div>
  );
}
