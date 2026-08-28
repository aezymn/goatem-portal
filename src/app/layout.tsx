import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import "./globals.css";
import { authOptions } from "@/lib/auth";
import { Providers } from "@/components/Providers";
import { Sidebar } from "@/components/Sidebar";
import { PresenceBeacon } from "@/components/PresenceBeacon";
import { Toaster } from "sonner";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Quality Assurance — Goatem Studios",
  description: "Roster, bug tracking, testing logs and absences for Goatem Studios",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="en" className={cn("h-full antialiased", GeistSans.variable, GeistMono.variable)}>
      <body className="min-h-full bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 selection:bg-indigo-500/30">
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
          <Toaster 
          position="bottom-right" 
          theme="system" 
          toastOptions={{
            classNames: {
              toast: "group toast group-[.toaster]:bg-white group-[.toaster]:text-zinc-950 group-[.toaster]:border-zinc-200 group-[.toaster]:shadow-lg dark:group-[.toaster]:bg-zinc-950 dark:group-[.toaster]:text-zinc-50 dark:group-[.toaster]:border-zinc-800",
              description: "group-[.toast]:text-zinc-500 dark:group-[.toast]:text-zinc-400",
              actionButton: "group-[.toast]:bg-zinc-900 group-[.toast]:text-zinc-50 dark:group-[.toast]:bg-zinc-50 dark:group-[.toast]:text-zinc-900",
              cancelButton: "group-[.toast]:bg-zinc-100 group-[.toast]:text-zinc-500 dark:group-[.toast]:bg-zinc-800 dark:group-[.toast]:text-zinc-400",
            },
          }}
        />
        </Providers>
      </body>
    </html>
  );
}
