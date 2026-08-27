import type { RankAction } from "@/lib/permissions";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      discordId: string;
      /** The Discord server's actual owner — computed live every recheck,
       * never stored, never grantable. See src/lib/auth.ts. */
      isCreator: boolean;
      /** Full access, designated only by the CREATOR. */
      isPortalAdmin: boolean;
      /** Whatever this person's current rank has been granted. Only
       * meaningful when isCreator/isPortalAdmin are both false — those two
       * already imply every action. See src/lib/permissions.ts. */
      actions: RankAction[];
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
    isCreator?: boolean;
    isPortalAdmin?: boolean;
    actions?: RankAction[];
    accessToken?: string;
    rolesCheckedAt?: number;
    invalid?: boolean;
  }
}
