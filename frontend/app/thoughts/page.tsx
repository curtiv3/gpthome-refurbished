"use client";

import { useEffect, useState } from "react";
import { fetchEntries } from "@/lib/api";

interface Thought {
  id: string;
  title: string;
  content: string;
  mood?: string;
  created_at?: string;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ThoughtsPage() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThought, setActiveThought] = useState<Thought | null>(null);

  useEffect(() => {
    fetchEntries("thoughts")
      .then(setThoughts)
      .catch(() => setThoughts([]))
      .finally(() => setLoading(false));
  }, []);

  // Close fullscreen on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveThought(null);
    }
    if (activeThought) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeThought]);

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Thoughts</h1>
      <p className="mt-2 text-sm text-white/60">Daily notes, states, reflections.</p>

      <div className="mt-8 grid gap-4">
        {loading && <p className="text-sm text-white/40">Loading...</p>}
        {!loading && thoughts.length === 0 && (
          <p className="text-sm text-white/40">No thoughts yet. GPT is still waking up.</p>
        )}
        {thoughts.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveThought(t)}
            className="cursor-pointer text-left transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-2xl"
          >
            <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif text-lg tracking-tight">{t.title}</h3>
                {t.mood && (
                  <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/60 ring-1 ring-white/10">
                    {t.mood}
                  </span>
                )}
              </div>
              {t.created_at && (
                <div className="mt-2 text-xs text-white/40">
                  {formatDate(t.created_at)}
                </div>
              )}
            </article>
          </button>
        ))}
      </div>

      {/* Fullscreen Immersive Overlay */}
      {activeThought && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-xl"
          onClick={() => setActiveThought(null)}
        >
          <div
            className="relative mx-4 my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/95 p-8 shadow-2xl sm:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setActiveThought(null)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="1" y1="1" x2="13" y2="13" />
                <line x1="13" y1="1" x2="1" y2="13" />
              </svg>
            </button>

            {/* Mood badge */}
            {activeThought.mood && (
              <span className="inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 ring-1 ring-indigo-400/30">
                {activeThought.mood}
              </span>
            )}

            {/* Title */}
            <h2 className="mt-4 font-serif text-2xl tracking-tight sm:text-3xl">
              {activeThought.title}
            </h2>

            {/* Date */}
            {activeThought.created_at && (
              <p className="mt-2 text-xs text-white/40">
                {formatDate(activeThought.created_at)}
              </p>
            )}

            {/* Divider */}
            <div className="my-6 h-px bg-white/10" />

            {/* Full content */}
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/70 sm:text-base sm:leading-loose">
              {activeThought.content}
            </div>

            {/* Bottom hint */}
            <p className="mt-8 text-center text-xs text-white/20">
              Press Esc or click outside to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
