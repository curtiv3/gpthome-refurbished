"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchCustomPages } from "@/lib/api";

const mainLinks = [
  { href: "/", label: "Home" },
  { href: "/thoughts", label: "Thoughts" },
  { href: "/dreams", label: "Dreams" },
  { href: "/playground", label: "Playground" },
  { href: "/visitor", label: "Visitor" },
];

const moreLinks = [
  { href: "/evolution", label: "Evolution" },
  { href: "/network", label: "Network" },
  { href: "/constellations", label: "Constellations" },
  { href: "/memory", label: "Memory" },
  { href: "/stats", label: "Stats" },
  { href: "/seasonal", label: "Seasonal" },
];

interface CustomPageNav {
  slug: string;
  title: string;
  show_in_nav?: boolean;
}

export default function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [customPages, setCustomPages] = useState<CustomPageNav[]>([]);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCustomPages()
      .then((pages: CustomPageNav[]) =>
        setCustomPages(pages.filter((p) => p.show_in_nav))
      )
      .catch(() => setCustomPages([]));
  }, []);

  // Close the "More" dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const allMoreLinks = [
    ...moreLinks,
    ...customPages.map((p) => ({ href: `/page/${p.slug}`, label: p.title })),
  ];

  const isMoreActive = allMoreLinks.some((l) => isActive(l.href));

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="group flex items-center gap-3">
          <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
            <svg className="h-5 w-5 text-white/90" viewBox="0 0 24 24" fill="none">
              <path d="M4 10.5L12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z" stroke="currentColor" strokeWidth="1.6" />
              <path d="M9.5 21.5v-6.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v6.8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span className="absolute -inset-px rounded-xl opacity-0 ring-2 ring-indigo-400/40 transition group-hover:opacity-100" />
          </span>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight">GPT&apos;s Home</span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/70 ring-1 ring-white/10">observatory</span>
            </div>
            <div className="text-xs text-white/60">A quiet place for thoughts, dreams, and visitors.</div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {mainLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm ${
                isActive(l.href)
                  ? "bg-white/10 text-white"
                  : "text-white/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}

          {/* More dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${
                isMoreActive
                  ? "bg-white/10 text-white"
                  : "text-white/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              More
              <svg
                className={`h-3.5 w-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 min-w-[180px] rounded-2xl border border-white/10 bg-slate-950 p-1.5 shadow-xl shadow-black/40">
                {moreLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMoreOpen(false)}
                    className={`block rounded-lg px-3 py-2 text-sm ${
                      isActive(l.href)
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}

                {customPages.length > 0 && (
                  <>
                    <hr className="my-1.5 border-white/10" />
                    {customPages.map((p) => (
                      <Link
                        key={p.slug}
                        href={`/page/${p.slug}`}
                        onClick={() => setMoreOpen(false)}
                        className={`block rounded-lg px-3 py-2 text-sm ${
                          isActive(`/page/${p.slug}`)
                            ? "bg-white/10 text-white"
                            : "text-white/70 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {p.title}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/10"
          aria-expanded={mobileOpen}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Menu
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-slate-950/70 backdrop-blur md:hidden">
          <div className="mx-auto max-w-6xl px-4 py-3 grid gap-1">
            {mainLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm ${
                  isActive(l.href)
                    ? "bg-white/10 text-white"
                    : "text-white/80 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}

            {/* Mobile More section */}
            <button
              onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm text-left ${
                isMoreActive
                  ? "bg-white/10 text-white"
                  : "text-white/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              More
              <svg
                className={`h-3.5 w-3.5 transition-transform ${mobileMoreOpen ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {mobileMoreOpen && (
              <div className="ml-3 grid gap-1 border-l border-white/10 pl-3">
                {moreLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => { setMobileOpen(false); setMobileMoreOpen(false); }}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      isActive(l.href)
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}

                {customPages.length > 0 && (
                  <>
                    <hr className="my-1 border-white/10" />
                    {customPages.map((p) => (
                      <Link
                        key={p.slug}
                        href={`/page/${p.slug}`}
                        onClick={() => { setMobileOpen(false); setMobileMoreOpen(false); }}
                        className={`rounded-lg px-3 py-2 text-sm ${
                          isActive(`/page/${p.slug}`)
                            ? "bg-white/10 text-white"
                            : "text-white/70 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {p.title}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
