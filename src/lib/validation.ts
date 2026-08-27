import { z } from "zod";
import { RANK_ACTIONS } from "@/lib/permissions";

// Every field a person can type into has a length cap — not just to keep
// the database tidy, but as a basic defense against someone trying to
// stuff huge payloads through the API directly (bypassing the UI, which
// obviously can't be relied on to enforce anything).

export const createReportSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(1).max(5000),
});

export const updateReportSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
  assigneeId: z.string().max(64).nullable().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
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
