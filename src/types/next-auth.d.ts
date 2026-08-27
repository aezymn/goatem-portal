import type { PermissionTier } from "@/lib/permissions";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      discordId: string;
      permissionTier: PermissionTier;
      roles: string[];
    } & DefaultSession["user"];
    /** True only when sign-in succeeded but the guild-membership/role
     * re-check has since failed (token expired, kicked from guild, etc).
     * The UI should treat this like a signed-out state. */
    stale?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    permissionTier?: PermissionTier;
    roles?: string[];
    accessToken?: string;
    rolesCheckedAt?: number;
    invalid?: boolean;
  }
}
