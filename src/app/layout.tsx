import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import "./globals.css";
import { authOptions } from "@/lib/auth";
import { Providers } from "@/components/Providers";
import { Sidebar } from "@/components/Sidebar";
import { PresenceBeacon } from "@/components/PresenceBeacon";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Quality Assurance — Goatem Studios",
  description: "Roster, bug tracking, testing logs and absences for Goatem Studios",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-50 dark:bg-black">
        <Providers session={session}>
          <PresenceBeacon />
          <Sidebar />
          {/* The sidebar is fixed, so the content is offset rather than
              sharing a flex row — that keeps it in place while the page
              scrolls, and lets it become an overlay on mobile without the
              main column jumping around. */}
          <main className="min-h-screen px-6 py-8 md:pl-72 md:pr-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
          <Toaster position="bottom-right" theme="system" richColors />
        </Providers>
      </body>
    </html>
  );
}
