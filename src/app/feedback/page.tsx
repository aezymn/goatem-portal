import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { feedbackReports } from "@/db/schema";
import { desc, eq, isNull, and } from "drizzle-orm";
import { isFullAdmin, hasAction } from "@/lib/permissions";
import type { RankAction } from "@/lib/permissions";
import { FeedbackForm } from "@/components/FeedbackForm";
import { FeedbackTriagePanel } from "@/components/FeedbackTriagePanel";

function accessCtx(user: { isCreator?: boolean; isPortalAdmin?: boolean; actions?: string[] }) {
  return {
    isCreator: user.isCreator ?? false,
    isPortalAdmin: user.isPortalAdmin ?? false,
    actions: (user.actions ?? []) as RankAction[],
  };
}

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  reviewed: "Reviewed",
  escalated: "Escalated",
  dismissed: "Dismissed",
};

const STATUS_COLOR: Record<string, string> = {
  new: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
  reviewed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  escalated: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  dismissed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500",
};

const SEVERITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

export default async function FeedbackPage() {
  const session = await getServerSession(authOptions);
  const live = session && !session.stale ? session : null;
  if (!live?.user?.discordId) redirect("/sign-in");

  const ctx = accessCtx(live.user);
  const canTriage = isFullAdmin(ctx) || hasAction(ctx, "reports.triage");
  const canSubmit = isFullAdmin(ctx) || hasAction(ctx, "feedback.submit");

  // Triagers see all entries; submitters see only their own.
  const rows = await db
    .select()
    .from(feedbackReports)
    .where(
      canTriage
        ? isNull(feedbackReports.deletedAt)
        : and(
            eq(feedbackReports.submitterDiscordId, live.user.discordId),
            isNull(feedbackReports.deletedAt)
          )
    )
    .orderBy(desc(feedbackReports.createdAt));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Beta Feedback
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {canTriage
            ? "Review, triage, and escalate feedback from Beta Testers into formal bug reports."
            : "Report issues you've found while testing. The QA team will review and escalate anything significant."}
        </p>
      </div>

      {/* Submission form — visible to Beta Testers and QA staff */}
      {(canSubmit || !canTriage) && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-base font-semibold">Submit an issue</h2>
          <FeedbackForm canSubmit={canSubmit} />
        </section>
      )}

      {/* Triage panel — only for QA triagers */}
      {canTriage && (
        <section>
          <h2 className="mb-3 text-base font-semibold">
            All feedback
            {rows.length > 0 && (
              <span className="ml-2 text-sm font-normal text-zinc-500">
                ({rows.length} total,{" "}
                {rows.filter((r) => r.status === "new").length} new)
              </span>
            )}
          </h2>
          <FeedbackTriagePanel items={rows} />
        </section>
      )}

      {/* Read-only list for Beta Testers viewing their own submissions */}
      {!canTriage && rows.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold">Your submissions</h2>
          <div className="flex flex-col gap-3">
            {rows.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <p className="flex-1 min-w-0 font-medium">{item.title}</p>
                  <div className="flex gap-1.5 shrink-0">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        SEVERITY_COLOR[item.severity] ?? ""
                      }`}
                    >
                      {SEVERITY_LABEL[item.severity] ?? item.severity}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLOR[item.status] ?? ""
                      }`}
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {item.status === "escalated" && (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                    ✓ Escalated to a bug report by the QA team.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!canTriage && rows.length === 0 && canSubmit && (
        <p className="text-sm text-zinc-500">
          You haven&apos;t submitted any feedback yet. Use the form above to
          report an issue.
        </p>
      )}
    </div>
  );
}
