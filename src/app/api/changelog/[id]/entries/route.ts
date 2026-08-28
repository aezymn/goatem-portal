import { NextResponse } from "next/server";
import { requireAction } from "@/lib/requireSession";
import { addEntry, changeNotesFor, getPost } from "@/lib/changelog";
import { changelogEntrySchema } from "@/lib/validation";

/** Adds a line to a post — either a custom one somebody typed, or one
 * pulled from a bug report and pre-filled with what the devs said they
 * changed. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/changelog/[id]/entries">
) {
  const auth = await requireAction("changelog.write");
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  if (!(await getPost(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = changelogEntrySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const reportId = parsed.data.bugReportId ?? null;
  let text = parsed.data.text;

  // A blank text with a report attached means "fill this in for me".
  if (reportId && text === "@auto") {
    const said = (await changeNotesFor([reportId])).get(reportId) ?? [];
    text =
      said.length > 0
        ? said.map((n) => n.body).join(" ")
        : "(nobody recorded what changed)";
  }

  const entry = await addEntry(id, text, reportId);
  return NextResponse.json({ entry }, { status: 201 });
}
