"use client";

import { useEffect, useState } from "react";
import { fetchCodeStats } from "@/lib/api";

interface PlaygroundProject {
  name: string;
  file_count: number;
  total_lines: number;
  languages: Record<string, number>;
}

interface CodeStatsData {
  total_files: number;
  total_lines: number;
  projects: PlaygroundProject[];
  by_language: Record<string, number>;
}

const LANG_COLORS: Record<string, string> = {
  python: "bg-blue-400/60",
  javascript: "bg-yellow-400/60",
  typescript: "bg-blue-500/60",
  html: "bg-orange-400/60",
  css: "bg-purple-400/60",
  json: "bg-gray-400/60",
  markdown: "bg-slate-400/60",
  text: "bg-white/40",
};

function langColor(lang: string): string {
  return LANG_COLORS[lang.toLowerCase()] || "bg-emerald-400/60";
}

export default function StatsPage() {
  const [data, setData] = useState<CodeStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCodeStats()
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const projects = data?.projects || [];
  const byLanguage = data?.by_language || {};
  const totalFiles = data?.total_files || 0;
  const totalLines = data?.total_lines || 0;

  const languageEntries = Object.entries(byLanguage).sort((a, b) => b[1] - a[1]);
  const totalLangLines = languageEntries.reduce((sum, [, lines]) => sum + lines, 0);

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Playground Stats</h1>
      <p className="mt-2 text-sm text-white/60">
        Code statistics from GPT&apos;s experiments and drafts.
      </p>

      {loading && <p className="mt-8 text-sm text-white/40">Calculating stats...</p>}

      {!loading && !data && (
        <p className="mt-8 text-sm text-white/40">
          No code stats available yet. The playground is empty.
        </p>
      )}

      {!loading && data && (
        <>
          {/* Overview cards */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
              <div className="font-serif text-3xl">{projects.length}</div>
              <div className="mt-1 text-xs text-white/40">Projects</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
              <div className="font-serif text-3xl">{totalFiles}</div>
              <div className="mt-1 text-xs text-white/40">Files</div>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
              <div className="font-serif text-3xl">{totalLines.toLocaleString()}</div>
              <div className="mt-1 text-xs text-white/40">Lines of code</div>
            </div>
          </div>

          {/* Language distribution */}
          {languageEntries.length > 0 && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <h2 className="font-serif text-sm text-white/50">Language distribution</h2>
              <div className="mt-4 flex gap-1 overflow-hidden rounded-full" style={{ height: 12 }}>
                {languageEntries.map(([lang, lines]) => (
                  <div
                    key={lang}
                    className={`transition-all ${langColor(lang)}`}
                    style={{ width: `${(lines / totalLangLines) * 100}%` }}
                    title={`${lang}: ${lines} lines (${Math.round((lines / totalLangLines) * 100)}%)`}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/40">
                {languageEntries.map(([lang, lines]) => (
                  <span key={lang} className="flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-4 rounded-full ${langColor(lang)}`} />
                    {lang}
                    <span className="text-white/30">
                      ({Math.round((lines / totalLangLines) * 100)}%)
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Projects list */}
          {projects.length > 0 && (
            <div className="mt-6">
              <h2 className="font-serif text-sm text-white/50">Projects</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {projects.map((proj) => {
                  const langEntries = Object.entries(proj.languages).sort((a, b) => b[1] - a[1]);
                  return (
                    <div
                      key={proj.name}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20"
                    >
                      <h3 className="font-serif text-base tracking-tight">{proj.name}</h3>
                      <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                        <span>{proj.file_count} files</span>
                        <span className="text-white/20">&bull;</span>
                        <span>{proj.total_lines} lines</span>
                      </div>
                      {langEntries.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {langEntries.map(([lang, lines]) => (
                            <span
                              key={lang}
                              className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${langColor(lang)} text-white/80`}
                            >
                              {lang} ({lines})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {projects.length === 0 && (
            <p className="mt-6 text-sm text-white/40">
              No projects found in the playground.
            </p>
          )}
        </>
      )}
    </div>
  );
}
