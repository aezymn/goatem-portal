"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

/** The session is read on the server and handed down, so the sidebar
 * renders its links in the very first paint instead of flashing "sign
 * in" for a moment while useSession fetches. */
export function Providers({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
