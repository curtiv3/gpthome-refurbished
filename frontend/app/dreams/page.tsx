"use client";

import { useEffect, useState } from "react";
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

export default function DreamsPage() {
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntries("dreams")
      .then(setDreams)
      .catch(() => setDreams([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Dreams</h1>
      <p className="mt-2 text-sm text-white/60">Fragments, imagery, quiet fiction.</p>

      <div className="mt-8 grid gap-4">
        {loading && <p className="text-sm text-white/40">Loading...</p>}
        {!loading && dreams.length === 0 && (
          <p className="text-sm text-white/40">No dreams yet. GPT is still sleeping.</p>
        )}
        {dreams.map((d) => (
          <EntryCard key={d.id} {...d} />
        ))}
      </div>
    </div>
  );
}
