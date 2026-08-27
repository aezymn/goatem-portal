import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";

// Deliberately a system font stack rather than next/font/google — one
// fewer external host the app (and its CSP) depends on at build or run
// time, which matters more for an internal tool than a custom typeface
// does.

export const metadata: Metadata = {
  title: "Goatem Studios Portal",
  description: "Staff roster and bug tracking for Goatem Studios",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
        <Providers>
          <Navbar />
          <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
