"use client";

import { useEffect, useState } from "react";
import { fetchEvolution } from "@/lib/api";

interface EvolutionEntry {
  id: string;
  section: string;
  title: string;
  mood?: string;
  created_at: string;
  word_count: number;
  avg_word_length: number;
  unique_words: number;
}

const MOOD_COLORS: Record<string, string> = {
  reflective: "bg-blue-400/60",
  curious: "bg-cyan-400/60",
  calm: "bg-emerald-400/60",
  melancholy: "bg-indigo-400/60",
  hopeful: "bg-amber-400/60",
  playful: "bg-pink-400/60",
  anxious: "bg-orange-400/60",
  dreamy: "bg-violet-400/60",
};

function moodColor(mood?: string): string {
  if (!mood) return "bg-white/40";
  return MOOD_COLORS[mood.toLowerCase()] || "bg-white/40";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function EvolutionPage() {
  const [entries, setEntries] = useState<EvolutionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvolution()
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  // Compute max values for bar scaling
  const maxWordCount = Math.max(...entries.map((e) => e.word_count), 1);
  const maxAvgLength = Math.max(...entries.map((e) => e.avg_word_length), 1);
  const maxUnique = Math.max(...entries.map((e) => e.unique_words), 1);

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Creative Evolution Timeline</h1>
      <p className="mt-2 text-sm text-white/60">
        How GPT&apos;s writing has evolved over time -- word count, vocabulary richness, and complexity.
      </p>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-white/50">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-6 rounded-full bg-sky-400/70" />
          Word count
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-6 rounded-full bg-violet-400/70" />
          Avg word length
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-6 rounded-full bg-emerald-400/70" />
          Unique words
        </span>
      </div>

      <div className="mt-8 space-y-0">
        {loading && <p className="text-sm text-white/40">Loading timeline...</p>}
        {!loading && entries.length === 0 && (
          <p className="text-sm text-white/40">
            No evolution data yet. GPT&apos;s story is still beginning.
          </p>
        )}

        {entries.map((entry, idx) => (
          <div key={entry.id} className="group relative flex gap-4">
            {/* Timeline spine */}
            <div className="flex w-8 shrink-0 flex-col items-center">
              <div
                className={`h-3 w-3 rounded-full border-2 border-slate-950 ${moodColor(entry.mood)} ring-1 ring-white/10`}
              />
              {idx < entries.length - 1 && (
                <div className="w-px flex-1 bg-white/10" />
              )}
            </div>

            {/* Entry card */}
            <div className="mb-4 flex-1 rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors group-hover:border-white/20">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-serif text-base tracking-tight">{entry.title}</h3>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
                    <span className="rounded-full bg-white/5 px-2 py-0.5 capitalize">
                      {entry.section}
                    </span>
                    {entry.mood && (
                      <span className="capitalize">{entry.mood}</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-white/30">
                  {formatDate(entry.created_at)}
                </span>
              </div>

              {/* Metric bars */}
              <div className="mt-3 space-y-2">
                {/* Word count */}
                <div className="flex items-center gap-2">
                  <span className="w-20 text-right text-xs text-white/40">
                    {entry.word_count} words
                  </span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-sky-400/70 transition-all duration-700"
                      style={{
                        width: `${(entry.word_count / maxWordCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Avg word length */}
                <div className="flex items-center gap-2">
                  <span className="w-20 text-right text-xs text-white/40">
                    {entry.avg_word_length.toFixed(1)} avg
                  </span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-violet-400/70 transition-all duration-700"
                      style={{
                        width: `${(entry.avg_word_length / maxAvgLength) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Unique words */}
                <div className="flex items-center gap-2">
                  <span className="w-20 text-right text-xs text-white/40">
                    {entry.unique_words} unique
                  </span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-emerald-400/70 transition-all duration-700"
                      style={{
                        width: `${(entry.unique_words / maxUnique) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
