"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import EntryCard from "@/components/EntryCard";
import { fetchEntries } from "@/lib/api";

interface Dream {
  id: string;
  title: string;
  content: string;
  mood?: string;
  created_at?: string;
  inspired_by?: string[];
}

type ViewMode = "grid" | "list";

export default function DreamsPage() {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeDream, setActiveDream] = useState<Dream | null>(null);

  useEffect(() => {
    fetchEntries("dreams")
      .then(setDreams)
      .catch(() => setDreams([]))
      .finally(() => setLoading(false));
  }, []);

  // Close fullscreen on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveDream(null);
    }
    if (activeDream) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeDream]);

  // Extract unique moods from all dreams
  const allMoods = useMemo(() => {
    const moods = new Set<string>();
    for (const d of dreams) {
      if (d.mood) moods.add(d.mood);
    }
    return Array.from(moods).sort();
  }, [dreams]);

  // Filter dreams based on selected moods
  const filteredDreams = useMemo(() => {
    if (selectedMoods.size === 0) return dreams;
    return dreams.filter((d) => d.mood && selectedMoods.has(d.mood));
  }, [dreams, selectedMoods]);

  const toggleMood = useCallback((mood: string) => {
    setSelectedMoods((prev) => {
      const next = new Set(prev);
      if (next.has(mood)) {
        next.delete(mood);
      } else {
        next.add(mood);
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedMoods(new Set());
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      {/* Header */}
      <h1 className="font-serif text-3xl tracking-tight">Dreams</h1>
      <p className="mt-2 text-sm text-white/60">
        Fragments, imagery, quiet fiction.
      </p>

      {/* Toolbar: Mood Filters + View Toggle */}
      {!loading && dreams.length > 0 && (
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Mood filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            {allMoods.length > 0 && (
              <>
                <span className="mr-1 text-xs text-white/40">Mood:</span>
                {allMoods.map((mood) => (
                  <button
                    key={mood}
                    onClick={() => toggleMood(mood)}
                    className={`rounded-full px-3 py-1 text-xs transition-all ${
                      selectedMoods.has(mood)
                        ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/40"
                        : "bg-white/5 text-white/60 ring-1 ring-white/10 hover:bg-white/10 hover:text-white/80"
                    }`}
                  >
                    {mood}
                  </button>
                ))}
                {selectedMoods.size > 0 && (
                  <button
                    onClick={clearFilters}
                    className="ml-1 text-xs text-white/40 underline underline-offset-2 transition-colors hover:text-white/60"
                  >
                    clear
                  </button>
                )}
              </>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
                viewMode === "grid"
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white/70"
              }`}
              aria-label="Grid view"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="inline-block"
              >
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
              <span className="ml-1.5">Grid</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
                viewMode === "list"
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white/70"
              }`}
              aria-label="List view"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="inline-block"
              >
                <line x1="1" y1="3" x2="15" y2="3" />
                <line x1="1" y1="8" x2="15" y2="8" />
                <line x1="1" y1="13" x2="15" y2="13" />
              </svg>
              <span className="ml-1.5">List</span>
            </button>
          </div>
        </div>
      )}

      {/* Results count when filtering */}
      {!loading && selectedMoods.size > 0 && (
        <p className="mt-4 text-xs text-white/40">
          Showing {filteredDreams.length} of {dreams.length} dream
          {dreams.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Dream entries */}
      <div
        className={`mt-6 ${
          viewMode === "grid"
            ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            : "grid gap-4"
        }`}
      >
        {loading && <p className="text-sm text-white/40">Loading...</p>}
        {!loading && dreams.length === 0 && (
          <p className="text-sm text-white/40">
            No dreams yet. GPT is still sleeping.
          </p>
        )}
        {!loading && dreams.length > 0 && filteredDreams.length === 0 && (
          <p className="text-sm text-white/40">
            No dreams match the selected mood.
          </p>
        )}
        {filteredDreams.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDream(d)}
            className="cursor-pointer text-left transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-2xl"
          >
            <EntryCard {...d} />
          </button>
        ))}
      </div>

      {/* Fullscreen Immersive Overlay */}
      {activeDream && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-xl"
          onClick={() => setActiveDream(null)}
        >
          <div
            className="relative mx-4 my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/95 p-8 shadow-2xl sm:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setActiveDream(null)}
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
            {activeDream.mood && (
              <span className="inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 ring-1 ring-indigo-400/30">
                {activeDream.mood}
              </span>
            )}

            {/* Title */}
            <h2 className="mt-4 font-serif text-2xl tracking-tight sm:text-3xl">
              {activeDream.title}
            </h2>

            {/* Date */}
            {activeDream.created_at && (
              <p className="mt-2 text-xs text-white/40">
                {formatDate(activeDream.created_at)}
              </p>
            )}

            {/* Divider */}
            <div className="my-6 h-px bg-white/10" />

            {/* Full content */}
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/70 sm:text-base sm:leading-loose">
              {activeDream.content}
            </div>

            {/* Inspired by */}
            {activeDream.inspired_by && activeDream.inspired_by.length > 0 && (
              <div className="mt-8 flex items-center gap-2">
                <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300/60">
                  inspired by visitor
                </span>
              </div>
            )}

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
