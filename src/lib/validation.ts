import { z } from "zod";
import { RANK_ACTIONS } from "@/lib/permissions";
import { TAG_TONES } from "@/lib/tagTones";
import { isValidAttachmentUrl } from "@/lib/attachments";

// Every field a person can type into has a length cap — not just to keep
// the database tidy, but as a basic defense against someone trying to
// stuff huge payloads through the API directly (bypassing the UI, which
// obviously can't be relied on to enforce anything).

// Attachments are links the portal embeds, never files it stores. The
// count and length caps are the same idea as every other cap here: the
// API has to hold on its own, whatever the form does.
const attachmentUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(isValidAttachmentUrl, "Attachments must be http(s) links");

const attachments = z.array(attachmentUrl).max(8).optional();

export const createReportSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(5000),
  categoryId: z.string().trim().max(64).nullable().optional(),
  tagIds: z.array(z.string().trim().max(64)).max(20).optional(),
  attachments,
});

// Status and assignee are both gone — state lives in tags now, and
// nobody is assigned a bug, they join it.
export const updateReportSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    categoryId: z.string().trim().max(64).nullable().optional(),
    tagIds: z.array(z.string().trim().max(64)).max(20).optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.categoryId !== undefined ||
      d.tagIds !== undefined,
    { message: "Nothing to update" }
  );

export const createCommentSchema = z.object({
  // A comment may be nothing but an attachment — posting a clip with no
  // words is a perfectly good contribution to the thread.
  body: z.string().trim().max(2000).optional().default(""),
  attachments,
  // The message this answers. Checked against the same report by the
  // route, so a reply can't be pointed at a comment from another thread.
  replyToId: z.string().trim().max(64).nullable().optional(),
}).refine((d) => d.body.length > 0 || (d.attachments?.length ?? 0) > 0, {
  message: "Write something or attach a link",
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Give the category a name").max(60),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Give the category a name").max(60),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(1, "Give the tag a name").max(40),
  tone: z.enum([...TAG_TONES] as [string, ...string[]]).optional(),
  groupId: z.string().trim().max(64).nullable().optional(),
  // Applying this tag closes and locks the report.
  locksReport: z.boolean().optional(),
});

export const createTagGroupSchema = z.object({
  name: z.string().trim().min(1, "Give the type a name").max(40),
  // Exclusive means a report carries at most one tag of this type —
  // Progress and Priority both want it.
  exclusive: z.boolean().optional(),
});

export const updateTagGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    exclusive: z.boolean().optional(),
  })
  .refine((d) => d.name !== undefined || d.exclusive !== undefined, {
    message: "Nothing to update",
  });

export const createStageSchema = z.object({
  title: z.string().trim().min(1, "Give the stage a name").max(120),
  note: z.string().trim().max(1000).nullable().optional(),
});

// Only an admin may pass this — everyone else acts on themselves and the
// route ignores the field entirely. See the route for the enforcement.
export const addParticipantSchema = z.object({
  memberId: z.string().trim().min(1).max(64).optional(),
});

export const updateTagSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    tone: z.enum([...TAG_TONES] as [string, ...string[]]).optional(),
    groupId: z.string().trim().max(64).nullable().optional(),
    locksReport: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.tone !== undefined ||
      d.groupId !== undefined ||
      d.locksReport !== undefined,
    { message: "Nothing to update" }
  );

export const reorderTaxonomySchema = z.object({
  order: z.array(z.string().trim().min(1).max(64)).min(1).max(200),
});

export const createMemberSchema = z.object({
  robloxUsername: z.string().trim().min(3).max(50),
  discordId: z
    .string()
    .trim()
    .regex(/^\d{15,25}$/, "must be a numeric Discord ID")
    .nullable()
    .optional(),
  rank: z.string().trim().min(1).max(50),
  status: z.string().trim().max(50).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

// isPortalAdmin is deliberately NOT editable through this schema — that's
// exclusively the CREATOR-gated Admin Access panel
// (src/app/api/admin/admins), never the regular roster edit form.
export const updateMemberSchema = createMemberSchema.partial();

export const createRankSchema = z.object({
  name: z.string().trim().min(1, "Give the rank a name").max(50),
});

export const reorderRanksSchema = z.object({
  // The full rank ladder, top (highest authority) to bottom, as an
  // ordered list of names. The API ignores any name that isn't already a
  // known rank rather than erroring, so a stale client can't corrupt
  // ranks it doesn't know about.
  order: z.array(z.string().trim().min(1).max(50)).min(1).max(200),
});

// One PATCH endpoint covers both edits a rank supports. Each field is
// optional, but sending neither is a mistake worth reporting rather than
// silently succeeding.
export const updateRankSchema = z
  .object({
    discordRoleId: z
      .string()
      .trim()
      .regex(/^\d{15,25}$/, "must be a numeric Discord role ID")
      .nullable()
      .optional(),
    name: z.string().trim().min(1, "Give the rank a name").max(50).optional(),
  })
  .refine((d) => d.discordRoleId !== undefined || d.name !== undefined, {
    message: "Nothing to update",
  });

export const setRankActionSchema = z.object({
  action: z.enum([...RANK_ACTIONS] as [string, ...string[]]),
  granted: z.boolean(),
});

export const addAdminSchema = z.object({
  memberId: z.string().trim().min(1).max(64),
});

// Roblox usernames: 3-20 characters, letters/digits/underscore, and at
// most one underscore which can't be at either end. Validating the shape
// here means an obviously-invalid entry never costs a Roblox API call.
export const robloxUsernameSchema = z
  .string()
  .trim()
  .min(3, "Roblox usernames are at least 3 characters")
  .max(20, "Roblox usernames are at most 20 characters")
  .regex(
    /^(?!_)(?!.*_.*_)[A-Za-z0-9_]+(?<!_)$/,
    "That isn't a valid Roblox username"
  );

export const linkRobloxSchema = z.object({
  robloxUsername: robloxUsernameSchema,
});

export const addAltSchema = z.object({
  robloxUsername: robloxUsernameSchema,
});

// Dates come from <input type="date">, so they arrive as YYYY-MM-DD and
// stay that way — a plain date column, not a timestamp. Absence is about
// which DAYS someone is away; attaching a time to it would only invite
// timezone bugs for no benefit.
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const createAbsenceSchema = z
  .object({
    leaveDate: isoDate,
    // The first day back and AVAILABLE, not the last day away.
    returnDate: isoDate,
    reason: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.returnDate >= d.leaveDate, {
    message: "The return date can't be before the leave date",
    path: ["returnDate"],
  });

export const createTestLogSchema = z.object({
  area: z.string().trim().min(2, "What did you test?").max(120),
  findings: z.string().trim().min(1, "Add what you found").max(5000),
  // Optional: not every session is worth timing, and forcing a number
  // invites made-up ones.
  minutesSpent: z.coerce.number().int().min(1).max(1440).nullable().optional(),
  testedAt: isoDate,
});
