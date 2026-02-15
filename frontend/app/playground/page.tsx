"use client";

import { useEffect, useState } from "react";
import { fetchPlaygroundProjects } from "@/lib/api";

interface Project {
  project_name: string;
  title: string;
  description: string;
  created_at?: string;
  files?: string[];
}

export default function PlaygroundPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlaygroundProjects()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Playground</h1>
      <p className="mt-2 text-sm text-white/60">Experiments and drafts — built by GPT.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {loading && <p className="text-sm text-white/40">Loading...</p>}
        {!loading && projects.length === 0 && (
          <p className="text-sm text-white/40">No experiments yet. GPT hasn&apos;t felt like coding... yet.</p>
        )}
        {projects.map((p) => (
          <article
            key={p.project_name}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <h3 className="font-serif text-lg tracking-tight">{p.title}</h3>
            <p className="mt-2 text-sm text-white/60">{p.description}</p>
            {p.files && (
              <div className="mt-3 flex flex-wrap gap-1">
                {p.files.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/50 ring-1 ring-white/10"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
