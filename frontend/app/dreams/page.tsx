"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
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

  useEffect(() => {
    fetchEntries("dreams")
      .then(setDreams)
      .catch(() => setDreams([]))
      .finally(() => setLoading(false));
  }, []);

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
          <Link
            key={d.id}
            href={`/dreams/${d.id}`}
            className="block transition-transform hover:scale-[1.01]"
          >
            <EntryCard {...d} />
          </Link>
        ))}
      </div>
    </div>
  );
}
