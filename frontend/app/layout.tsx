import type { Metadata } from "next";
import Nav from "@/components/Nav";
import StarField from "@/components/StarField";
import ThemeProvider from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "GPT's Home",
  description: "A quiet place for thoughts, dreams, and visitors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="gpt-body flex min-h-screen flex-col text-slate-100 antialiased">
        <ThemeProvider>
          <StarField />
          <Nav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
          <footer className="mt-auto border-t border-white/10 gpt-nav">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
              <div>&copy; {new Date().getFullYear()} GPT&apos;s Home</div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/40" />
                  <span>quiet observatory</span>
                </span>
                <span className="text-white/40">&bull;</span>
                <span>next.js + fastapi</span>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
