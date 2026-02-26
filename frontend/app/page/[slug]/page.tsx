"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchCustomPage } from "@/lib/api";

interface CustomPage {
  slug: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/* ── Inline formatting via React elements (no innerHTML) ── */
const INLINE_TOKEN = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;

function renderInline(line: string, lineKey: number) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let pk = 0;
  let m: RegExpExecArray | null;

  INLINE_TOKEN.lastIndex = 0;
  while ((m = INLINE_TOKEN.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    if (m[1] != null) {
      parts.push(
        <strong key={pk++} className="font-semibold text-white/90">
          {m[1]}
        </strong>
      );
    } else if (m[2] != null) {
      parts.push(
        <em key={pk++} className="italic text-white/70">
          {m[2]}
        </em>
      );
    } else if (m[3] != null) {
      parts.push(
        <code
          key={pk++}
          className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-mono text-white/80"
        >
          {m[3]}
        </code>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));

  return (
    <p key={lineKey} className="my-1">
      {parts.length > 0 ? parts : line}
    </p>
  );
}

export default function CustomPageView() {
  const params = useParams();
  const slug = params.slug as string;

  const [page, setPage] = useState<CustomPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);

    fetchCustomPage(slug)
      .then((data) => setPage(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-white/40">Loading page...</p>
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <h1 className="font-serif text-3xl tracking-tight">Page not found</h1>
          <p className="mt-3 text-sm text-white/60">
            The page &ldquo;{slug}&rdquo; doesn&apos;t exist or hasn&apos;t been created yet.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-xl bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/15"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
        <h1 className="font-serif text-3xl tracking-tight md:text-4xl">
          {page.title}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/40">
          <span>By {page.created_by}</span>
          <span className="hidden sm:inline">&middot;</span>
          <span>
            {new Date(page.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          {page.updated_at !== page.created_at && (
            <>
              <span className="hidden sm:inline">&middot;</span>
              <span>
                Updated{" "}
                {new Date(page.updated_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>

        <hr className="my-6 border-white/10" />

        <div
          className="prose-invert max-w-none text-sm leading-relaxed text-white/80"
          style={{ whiteSpace: "pre-wrap" }}
        >
          {page.content.split("\n").map((line, i) => {
            // Basic heading support: lines starting with # ## ###
            if (line.startsWith("### ")) {
              return (
                <h3
                  key={i}
                  className="mb-2 mt-6 font-serif text-lg font-medium text-white/90"
                >
                  {line.slice(4)}
                </h3>
              );
            }
            if (line.startsWith("## ")) {
              return (
                <h2
                  key={i}
                  className="mb-2 mt-6 font-serif text-xl font-medium text-white/90"
                >
                  {line.slice(3)}
                </h2>
              );
            }
            if (line.startsWith("# ")) {
              return (
                <h2
                  key={i}
                  className="mb-3 mt-6 font-serif text-2xl font-medium text-white/90"
                >
                  {line.slice(2)}
                </h2>
              );
            }

            // Horizontal rule
            if (line.trim() === "---" || line.trim() === "***") {
              return <hr key={i} className="my-4 border-white/10" />;
            }

            // Empty lines become spacing
            if (line.trim() === "") {
              return <div key={i} className="h-3" />;
            }

            // Bold, italic, code — rendered as React elements (no innerHTML)
            return renderInline(line, i);
          })}
        </div>
      </div>
    </div>
  );
}
