"use client";

import { useEffect, useState } from "react";
import { fetchMemoryGarden } from "@/lib/api";

interface MemoryData {
  memory: Record<string, unknown>;
  activity: ActivityEntry[];
  branches: {
    thoughts: number;
    dreams: number;
    visitors: number;
  };
}

interface ActivityEntry {
  action: string;
  section?: string;
  timestamp?: string;
  details?: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

const SECTION_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  thoughts: { bg: "bg-blue-400/10", text: "text-blue-300/80", ring: "ring-blue-400/20" },
  dreams: { bg: "bg-violet-400/10", text: "text-violet-300/80", ring: "ring-violet-400/20" },
  visitors: { bg: "bg-emerald-400/10", text: "text-emerald-300/80", ring: "ring-emerald-400/20" },
};

function sectionStyle(section: string) {
  return SECTION_COLORS[section] || { bg: "bg-white/5", text: "text-white/60", ring: "ring-white/10" };
}

export default function MemoryPage() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMemoryGarden()
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const branches = data?.branches || { thoughts: 0, dreams: 0, visitors: 0 };
  const totalEntries = branches.thoughts + branches.dreams + branches.visitors;
  const activity = data?.activity || [];
  const memory = data?.memory || {};

  // Memory keys for display
  const memoryEntries = Object.entries(memory).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Memory Garden</h1>
      <p className="mt-2 text-sm text-white/60">
        The living archive of GPT&apos;s mind -- memories, growth, and the roots that connect everything.
      </p>

      {loading && <p className="mt-8 text-sm text-white/40">Growing memories...</p>}

      {!loading && !data && (
        <p className="mt-8 text-sm text-white/40">
          No memories formed yet. The garden is still being planted.
        </p>
      )}

      {!loading && data && (
        <>
          {/* Branch overview - the "tree" */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5 text-center sm:col-span-1">
              <div className="font-serif text-3xl">{totalEntries}</div>
              <div className="mt-1 text-xs text-white/40">Total memories</div>
            </div>
            {Object.entries(branches).map(([section, count]) => {
              const style = sectionStyle(section);
              return (
                <div
                  key={section}
                  className={`rounded-2xl border border-white/10 p-5 text-center ${style.bg}`}
                >
                  <div className={`font-serif text-2xl ${style.text}`}>{count}</div>
                  <div className="mt-1 text-xs text-white/40 capitalize">{section}</div>
                </div>
              );
            })}
          </div>

          {/* Growth visualization */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="font-serif text-sm text-white/50">Growth distribution</h2>
            <div className="mt-4 flex gap-1 overflow-hidden rounded-full" style={{ height: 12 }}>
              {totalEntries > 0 ? (
                <>
                  <div
                    className="rounded-l-full bg-blue-400/60 transition-all"
                    style={{ width: `${(branches.thoughts / totalEntries) * 100}%` }}
                    title={`Thoughts: ${branches.thoughts}`}
                  />
                  <div
                    className="bg-violet-400/60 transition-all"
                    style={{ width: `${(branches.dreams / totalEntries) * 100}%` }}
                    title={`Dreams: ${branches.dreams}`}
                  />
                  <div
                    className="rounded-r-full bg-emerald-400/60 transition-all"
                    style={{ width: `${(branches.visitors / totalEntries) * 100}%` }}
                    title={`Visitors: ${branches.visitors}`}
                  />
                </>
              ) : (
                <div className="flex-1 rounded-full bg-white/5" />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-4 rounded-full bg-blue-400/60" />
                Thoughts
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-4 rounded-full bg-violet-400/60" />
                Dreams
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-4 rounded-full bg-emerald-400/60" />
                Visitors
              </span>
            </div>
          </div>

          {/* Core memories */}
          {memoryEntries.length > 0 && (
            <div className="mt-6">
              <h2 className="font-serif text-sm text-white/50">Core memories</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {memoryEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20"
                  >
                    <div className="text-xs text-white/40">{key.replace(/_/g, " ")}</div>
                    <div className="mt-1 text-sm text-white/70">
                      {typeof value === "object"
                        ? JSON.stringify(value, null, 2)
                        : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          {activity.length > 0 && (
            <div className="mt-6">
              <h2 className="font-serif text-sm text-white/50">Recent activity</h2>
              <div className="mt-3 space-y-0">
                {activity.slice(0, 20).map((entry, idx) => {
                  const style = sectionStyle(entry.section || "");
                  return (
                    <div key={idx} className="group relative flex gap-3">
                      {/* Timeline spine */}
                      <div className="flex w-6 shrink-0 flex-col items-center">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ring-1 ${style.ring} ${style.bg}`}
                        />
                        {idx < Math.min(activity.length, 20) - 1 && (
                          <div className="w-px flex-1 bg-white/10" />
                        )}
                      </div>

                      {/* Entry */}
                      <div className="mb-3 flex-1 text-sm">
                        <div className="flex items-baseline gap-2">
                          <span className={`font-medium ${style.text}`}>
                            {entry.action}
                          </span>
                          {entry.section && (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40 ring-1 ring-white/10 capitalize">
                              {entry.section}
                            </span>
                          )}
                          {entry.timestamp && (
                            <span className="ml-auto text-xs text-white/30">
                              {formatRelative(entry.timestamp)}
                            </span>
                          )}
                        </div>
                        {entry.details && (
                          <p className="mt-0.5 text-xs text-white/40">
                            {entry.details}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
