import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireAction } from "@/lib/requireSession";
import { displayNameFor, getMemberByDiscordId } from "@/lib/members";
import { logAudit } from "@/lib/audit";
import {
  addEntry,
  changeNotesFor,
  createPost,
  latestVersion,
  listPosts,
} from "@/lib/changelog";
import { nextVersion, parseVersion } from "@/lib/versions";
import { createChangelogPostSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireAction("changelog.view");
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    posts: await listPosts({ publishedOnly: true }),
  });
}

export async function POST(request: Request) {
  const auth = await requireAction("changelog.write");
  if (!auth.ok) return auth.response;
  const { discordId } = auth.session.user;

  const author = await getMemberByDiscordId(discordId);
  if (!author) {
    return NextResponse.json(
      { error: "You're not on the roster." },
      { status: 409 }
    );
  }

  const parsed = createChangelogPostSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // An explicit version wins; otherwise the release kind decides, worked
  // out from the highest version already in the log.
  const explicit = parsed.data.version
    ? parseVersion(parsed.data.version)
    : null;
  if (parsed.data.version && !explicit) {
    return NextResponse.json(
      { error: "Versions look like 0.9 or 0.9.1" },
      { status: 400 }
    );
  }
  const version =
    explicit ?? nextVersion(await latestVersion(), parsed.data.kind ?? "update");

  const post = await createPost({
    title: parsed.data.title,
    version,
    body: parsed.data.body ?? null,
    createdById: author.id,
  });

  // Each linked report becomes an entry, pre-filled with what the devs
  // said they changed. Several notes on one report are joined into one
  // line for editing rather than becoming several bullets nobody asked
  // for.
  const reportIds = parsed.data.reportIds ?? [];
  if (post && reportIds.length > 0) {
    const notes = await changeNotesFor(reportIds);
    for (const reportId of reportIds) {
      const said = notes.get(reportId) ?? [];
      const text =
        said.length > 0
          ? said.map((n) => n.body).join(" ")
          : "(nobody recorded what changed)";
      await addEntry(post.id, text, reportId);
    }
  }

  await logAudit(db, {
    actorDiscordId: discordId,
    actorName: displayNameFor(author),
    action: "changelog.create",
    targetType: "changelog_post",
    targetId: post?.id,
    metadata: { version: post?.version, title: post?.title },
  });

  return NextResponse.json({ post }, { status: 201 });
}
