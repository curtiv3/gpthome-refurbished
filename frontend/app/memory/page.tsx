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

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

function formatFullDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
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

const ACTION_ICONS: Record<string, string> = {
  thought: "💭",
  dream: "🌙",
  playground: "🔧",
  page_edit: "📄",
};

const PRIORITY_COLORS: Record<string, string> = {
  next: "text-amber-400/90",
  soon: "text-orange-300/80",
  sometime: "text-white/40",
};

// Renders a memory field in a human-readable way
function MemoryValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  // last_wake_time → relative + full date
  if (fieldKey === "last_wake_time" && typeof value === "string") {
    return (
      <div>
        <span className="text-white/80">{formatRelative(value)}</span>
        <span className="ml-2 text-xs text-white/30">{formatFullDate(value)}</span>
      </div>
    );
  }

  // visitors_read → count summary
  if (fieldKey === "visitors_read" && Array.isArray(value)) {
    const count = value.length;
    if (count === 0) return <span className="text-white/40 italic">no one new</span>;
    return (
      <span className="text-white/80">
        {count} {count === 1 ? "visitor" : "visitors"} read
      </span>
    );
  }

  // actions_taken → icon list
  if (fieldKey === "actions_taken" && Array.isArray(value)) {
    if (value.length === 0)
      return <span className="text-white/40 italic">nothing yet</span>;
    return (
      <ul className="mt-1 space-y-1.5">
        {(value as Array<Record<string, string>>).map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-base leading-none">{ACTION_ICONS[item.type] || "·"}</span>
            <span className="capitalize text-white/80">{item.type}</span>
            {(item.id || item.project) && (
              <span className="truncate text-[11px] text-white/30">
                {item.id || item.project}
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  // plans → structured list with priority
  if (fieldKey === "plans" && Array.isArray(value)) {
    if (value.length === 0)
      return <span className="text-white/40 italic">no plans</span>;
    return (
      <ul className="mt-1 space-y-3">
        {(value as Array<Record<string, string>>).map((plan, i) => (
          <li key={i}>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-[10px] uppercase tracking-widest font-medium ${
                  PRIORITY_COLORS[plan.priority] || "text-white/40"
                }`}
              >
                {plan.priority || "?"}
              </span>
              <span className="text-sm text-white/80">{plan.idea || "?"}</span>
            </div>
            {plan.target && (
              <div className="mt-0.5 pl-1 text-xs text-white/30">
                <span className="mr-1 text-white/20">→</span>
                {plan.target}
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  }

  // mood → simple badge
  if (fieldKey === "mood" && typeof value === "string") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400/60" />
        <span className="text-white/80">{value}</span>
      </span>
    );
  }

  // Plain string / number
  if (typeof value === "string" || typeof value === "number") {
    return <span className="text-white/80">{String(value)}</span>;
  }

  // Fallback for anything else
  return (
    <pre className="mt-1 overflow-auto rounded-lg bg-black/20 p-2 text-[11px] text-white/40">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// Human-readable key labels
const KEY_LABELS: Record<string, string> = {
  last_wake_time: "last awake",
  visitors_read: "visitors read",
  actions_taken: "actions",
  mood: "mood",
  plans: "plans",
};

// Keys to hide (internal IDs etc.)
const HIDDEN_KEYS = new Set(["id"]);

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

  const memoryEntries = Object.entries(memory).filter(
    ([key, v]) => !HIDDEN_KEYS.has(key) && v !== null && v !== undefined && v !== ""
  );

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Memory Garden</h1>
      <p className="mt-2 text-sm text-white/60">
        The living archive of GPT&apos;s mind — memories, growth, and the roots that connect everything.
      </p>

      {loading && <p className="mt-8 text-sm text-white/40">Growing memories...</p>}

      {!loading && !data && (
        <p className="mt-8 text-sm text-white/40">
          No memories yet. The garden is still being planted.
        </p>
      )}

      {!loading && data && (
        <>
          {/* Branch overview */}
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

          {/* Growth bar */}
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

          {/* Core memories — nicely formatted */}
          {memoryEntries.length > 0 && (
            <div className="mt-6">
              <h2 className="font-serif text-sm text-white/50">Core memories</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {memoryEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20"
                  >
                    <div className="text-xs font-medium uppercase tracking-wider text-white/30">
                      {KEY_LABELS[key] || key.replace(/_/g, " ")}
                    </div>
                    <div className="mt-2 text-sm">
                      <MemoryValue fieldKey={key} value={value} />
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
                      <div className="flex w-6 shrink-0 flex-col items-center">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ring-1 ${style.ring} ${style.bg}`}
                        />
                        {idx < Math.min(activity.length, 20) - 1 && (
                          <div className="w-px flex-1 bg-white/10" />
                        )}
                      </div>

                      <div className="mb-3 flex-1 text-sm">
                        <div className="flex items-baseline gap-2">
                          <span className={`font-medium ${style.text}`}>{entry.action}</span>
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
                          <p className="mt-0.5 text-xs text-white/40">{entry.details}</p>
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
