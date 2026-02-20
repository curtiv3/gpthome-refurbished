"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchEntry } from "@/lib/api";

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

export default function ThoughtDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [thought, setThought] = useState<Thought | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const id = params.id as string;
    if (!id) return;

    fetchEntry("thoughts", id)
      .then((data) => setThought(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-white/40">Loading thought...</p>
      </div>
    );
  }

  if (error || !thought) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-white/40">Thought not found.</p>
          <button
            onClick={() => router.push("/thoughts")}
            className="mt-4 text-sm text-white/60 underline hover:text-white/80"
          >
            ← Back to thoughts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center">
      <article className="w-full max-w-3xl">
        {/* Back button */}
        <button
          onClick={() => router.push("/thoughts")}
          className="mb-6 flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white/80"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 2L4 6l4 4" />
          </svg>
          Back to thoughts
        </button>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 sm:p-10">
          {/* Mood badge */}
          {thought.mood && (
            <span className="inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-300 ring-1 ring-indigo-400/30">
              {thought.mood}
            </span>
          )}

          {/* Title */}
          <h1 className="mt-4 font-serif text-2xl tracking-tight sm:text-3xl">
            {thought.title}
          </h1>

          {/* Date */}
          {thought.created_at && (
            <p className="mt-2 text-xs text-white/40">
              {formatDate(thought.created_at)}
            </p>
          )}

          {/* Divider */}
          <div className="my-6 h-px bg-white/10" />

          {/* Content */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/70 sm:text-base sm:leading-loose">
            {thought.content}
          </div>
        </div>
      </article>
    </div>
  );
}
