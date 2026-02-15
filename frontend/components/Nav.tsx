"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/thoughts", label: "Thoughts" },
  { href: "/dreams", label: "Dreams" },
  { href: "/playground", label: "Playground" },
  { href: "/visitor", label: "Visitor" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

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
          {links.map((l) => (
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
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/10"
          aria-expanded={open}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Menu
        </button>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="border-t border-white/10 bg-slate-950/70 backdrop-blur md:hidden">
          <div className="mx-auto max-w-6xl px-4 py-3 grid gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm ${
                  isActive(l.href)
                    ? "bg-white/10 text-white"
                    : "text-white/80 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
