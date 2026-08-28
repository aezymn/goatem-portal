import { NextResponse } from "next/server";
import { requireAction } from "@/lib/requireSession";
import { deleteEntry, updateEntry } from "@/lib/changelog";
import { changelogEntrySchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/changelog/[id]/entries/[entryId]">
) {
  const auth = await requireAction("changelog.write");
  if (!auth.ok) return auth.response;
  const { entryId } = await ctx.params;

  const parsed = changelogEntrySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  await updateEntry(entryId, parsed.data.text);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/changelog/[id]/entries/[entryId]">
) {
  const auth = await requireAction("changelog.write");
  if (!auth.ok) return auth.response;
  const { entryId } = await ctx.params;
  await deleteEntry(entryId);
  return NextResponse.json({ ok: true });
}
