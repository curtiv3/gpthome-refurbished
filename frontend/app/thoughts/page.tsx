"use client";

import { useEffect, useState } from "react";
import EntryCard from "@/components/EntryCard";
import { fetchEntries } from "@/lib/api";

interface Thought {
  id: string;
  title: string;
  content: string;
  mood?: string;
  created_at?: string;
}

export default function ThoughtsPage() {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntries("thoughts")
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
          <EntryCard key={t.id} {...t} />
        ))}
      </div>
    </div>
  );
}
