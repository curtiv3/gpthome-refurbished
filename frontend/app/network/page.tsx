"use client";

import { useEffect, useState } from "react";
import { fetchVisitorAnalytics } from "@/lib/api";

interface Visitor {
  name: string;
  message_count: number;
  first_visit: string;
  last_visit: string;
  dates: string[];
}

interface VisitorStats {
  total: number;
  unique_names: number;
  by_date: Record<string, number>;
}

interface VisitorData {
  stats: VisitorStats;
  visitors: Visitor[];
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

/** Simple hash to pick a hue for each visitor name */
function nameHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export default function NetworkPage() {
  const [data, setData] = useState<VisitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetchVisitorAnalytics()
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const visitors = data?.visitors || [];
  const stats = data?.stats;
  const maxMessages = Math.max(...visitors.map((v) => v.message_count), 1);

  // Sort dates for the activity strip
  const allDates = Object.entries(stats?.by_date || {}).sort(
    ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
  );
  const maxByDate = Math.max(...allDates.map(([, c]) => c), 1);

  const selectedVisitor = selected
    ? visitors.find((v) => v.name === selected)
    : null;

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Visitor Network</h1>
      <p className="mt-2 text-sm text-white/60">
        Connections forged through messages -- the web of visitors who stopped by.
      </p>

      {loading && <p className="mt-8 text-sm text-white/40">Loading network...</p>}

      {!loading && !data && (
        <p className="mt-8 text-sm text-white/40">
          No visitor data available yet. The guestbook is still empty.
        </p>
      )}

      {!loading && data && (
        <>
          {/* Summary stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="font-serif text-2xl">{stats?.total ?? 0}</div>
              <div className="mt-1 text-xs text-white/40">Total messages</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="font-serif text-2xl">{stats?.unique_names ?? 0}</div>
              <div className="mt-1 text-xs text-white/40">Unique visitors</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center sm:col-span-1 col-span-2">
              <div className="font-serif text-2xl">{allDates.length}</div>
              <div className="mt-1 text-xs text-white/40">Active days</div>
            </div>
          </div>

          {/* Activity heatmap strip */}
          {allDates.length > 0 && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="font-serif text-sm text-white/50">Visit activity</h2>
              <div className="mt-3 flex items-end gap-px" style={{ minHeight: 48 }}>
                {allDates.map(([date, count]) => (
                  <div
                    key={date}
                    className="group relative flex-1"
                    title={`${date}: ${count}`}
                  >
                    <div
                      className="mx-auto w-full min-w-[3px] rounded-t bg-sky-400/60 transition-all hover:bg-sky-400/90"
                      style={{
                        height: `${Math.max((count / maxByDate) * 48, 3)}px`,
                      }}
                    />
                    <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white/60 opacity-0 transition-opacity group-hover:opacity-100">
                      {formatDate(date)}: {count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visitor constellation */}
          <div className="mt-6">
            <h2 className="font-serif text-sm text-white/50">Visitors</h2>

            {visitors.length === 0 && (
              <p className="mt-3 text-sm text-white/40">No visitors recorded yet.</p>
            )}

            {/* Connection web - simple CSS radial layout */}
            <div className="relative mt-4 flex min-h-[200px] flex-wrap items-center justify-center gap-3">
              {/* Center node */}
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 ring-4 ring-white/5" />

              {visitors.map((v) => {
                const hue = nameHue(v.name);
                const size = 28 + (v.message_count / maxMessages) * 36;
                const isSelected = selected === v.name;

                return (
                  <button
                    key={v.name}
                    onClick={() => setSelected(isSelected ? null : v.name)}
                    className={`relative flex items-center justify-center rounded-full border transition-all ${
                      isSelected
                        ? "border-white/30 ring-2 ring-white/20 scale-110"
                        : "border-white/10 hover:border-white/20"
                    }`}
                    style={{
                      width: size,
                      height: size,
                      backgroundColor: `hsla(${hue}, 50%, 60%, 0.15)`,
                    }}
                    title={`${v.name}: ${v.message_count} messages`}
                  >
                    <span
                      className="text-xs font-medium"
                      style={{ color: `hsla(${hue}, 60%, 75%, 0.9)`, fontSize: Math.max(9, size / 4) }}
                    >
                      {v.name.slice(0, 2).toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected visitor detail */}
          {selectedVisitor && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg tracking-tight">
                    {selectedVisitor.name}
                  </h3>
                  <p className="mt-1 text-xs text-white/40">
                    {selectedVisitor.message_count}{" "}
                    {selectedVisitor.message_count === 1 ? "message" : "messages"}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs text-white/30 hover:text-white/60"
                >
                  close
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-white/40">First visit</div>
                  <div className="mt-0.5 text-white/70">
                    {formatDate(selectedVisitor.first_visit)}
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="text-white/40">Last visit</div>
                  <div className="mt-0.5 text-white/70">
                    {formatDate(selectedVisitor.last_visit)}
                  </div>
                </div>
              </div>

              {/* Visit dates */}
              {selectedVisitor.dates.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-white/40">Visit dates</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedVisitor.dates.map((d) => (
                      <span
                        key={d}
                        className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50 ring-1 ring-white/10"
                      >
                        {formatDate(d)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
