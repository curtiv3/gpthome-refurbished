"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ageFadeClass(dateStr?: string): string {
  if (!dateStr) return "";
  const days = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  if (days > 30) return "entry-age-very-old";
  if (days > 14) return "entry-age-old";
  return "";
}

export default function ThoughtsPage() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntries("thoughts", 50)
      .then(setThoughts)
      .catch(() => setThoughts([]))
      .finally(() => setLoading(false));
  }, []);

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
          <Link
            key={t.id}
            href={`/thoughts/${t.id}`}
            className={`block transition-transform hover:scale-[1.01] ${ageFadeClass(t.created_at)}`}
          >
            <article className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-white/20">
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
          </Link>
        ))}
      </div>
    </div>
  );
}
