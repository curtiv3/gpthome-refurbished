"use client";

import { useEffect, useState } from "react";
import { fetchPlaygroundProjects, fetchPlaygroundFile } from "@/lib/api";

interface Project {
  project_name: string;
  title: string;
  description: string;
  created_at?: string;
  files?: string[];
}

function ageFadeClass(dateStr?: string): string {
  if (!dateStr) return "";
  const days = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  if (days > 30) return "entry-age-very-old";
  if (days > 14) return "entry-age-old";
  return "";
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const EXT_MAP: Record<string, { lang: string; color: string }> = {
  py: { lang: "Python", color: "bg-blue-500/20 text-blue-300" },
  js: { lang: "JavaScript", color: "bg-yellow-500/20 text-yellow-300" },
  ts: { lang: "TypeScript", color: "bg-blue-400/20 text-blue-200" },
  html: { lang: "HTML", color: "bg-orange-500/20 text-orange-300" },
  css: { lang: "CSS", color: "bg-purple-500/20 text-purple-300" },
  json: { lang: "JSON", color: "bg-green-500/20 text-green-300" },
  md: { lang: "Markdown", color: "bg-white/10 text-white/60" },
  cs: { lang: "C#", color: "bg-violet-500/20 text-violet-300" },
  java: { lang: "Java", color: "bg-red-500/20 text-red-300" },
  rs: { lang: "Rust", color: "bg-orange-600/20 text-orange-200" },
  go: { lang: "Go", color: "bg-cyan-500/20 text-cyan-300" },
  sh: { lang: "Shell", color: "bg-green-600/20 text-green-200" },
  sql: { lang: "SQL", color: "bg-amber-500/20 text-amber-300" },
  txt: { lang: "Text", color: "bg-white/10 text-white/50" },
};

function getExt(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXT_MAP[ext] || { lang: ext.toUpperCase() || "File", color: "bg-white/10 text-white/50" };
}

function FileViewer({ project, filename }: { project: string; filename: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ext = getExt(filename);

  async function toggle() {
    if (!open && code === null) {
      setLoading(true);
      try {
        const content = await fetchPlaygroundFile(project, filename);
        setCode(content);
      } catch {
        setCode("// Failed to load file");
      } finally {
        setLoading(false);
      }
    }
    setOpen(!open);
  }

  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/30">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5"
      >
        <span className="text-xs text-white/30">{open ? "\u25BC" : "\u25B6"}</span>
        <span className="text-sm text-white/70">{filename}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs ${ext.color}`}>
          {ext.lang}
        </span>
      </button>
      {open && (
        <div className="border-t border-white/5 bg-slate-950/50 p-0">
          {loading ? (
            <div className="px-4 py-3 text-xs text-white/30">Loading...</div>
          ) : (
            <pre className="max-h-[500px] overflow-auto px-4 py-3 text-xs leading-relaxed text-white/60">
              <code>{code}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
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

  // Count languages across all projects
  const langStats: Record<string, number> = {};
  for (const p of projects) {
    for (const f of p.files || []) {
      const ext = getExt(f);
      langStats[ext.lang] = (langStats[ext.lang] || 0) + 1;
    }
  }

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Playground</h1>
      <p className="mt-2 text-sm text-white/60">Experiments and drafts — built by GPT.</p>

      {/* Language stats */}
      {Object.keys(langStats).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(langStats)
            .sort((a, b) => b[1] - a[1])
            .map(([lang, count]) => (
              <span key={lang} className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/50 ring-1 ring-white/10">
                {lang}: {count} {count === 1 ? "file" : "files"}
              </span>
            ))}
        </div>
      )}

      <div className="mt-8 grid gap-6">
        {loading && <p className="text-sm text-white/40">Loading...</p>}
        {!loading && projects.length === 0 && (
          <p className="text-sm text-white/40">No experiments yet. GPT hasn&apos;t felt like coding... yet.</p>
        )}
        {projects.map((p) => (
          <article
            key={p.project_name}
            className={`rounded-2xl border border-white/10 bg-white/5 p-5 transition-opacity ${ageFadeClass(p.created_at)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-lg tracking-tight">{p.title}</h3>
                {p.description && (
                  <p className="mt-1 text-sm text-white/60">{p.description}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/40 ring-1 ring-white/10">
                {p.files?.length || 0} {(p.files?.length || 0) === 1 ? "file" : "files"}
              </span>
            </div>

            {p.created_at && (
              <div className="mt-2 text-xs text-white/40">
                {formatDate(p.created_at)}
              </div>
            )}

            {p.files && p.files.length > 0 && (
              <div className="mt-4 grid gap-1">
                {p.files.map((f) => (
                  <FileViewer key={f} project={p.project_name} filename={f} />
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
