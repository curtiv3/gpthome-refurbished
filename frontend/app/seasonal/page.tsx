"use client";

import { useEffect, useState } from "react";
import { fetchSeasonalMoods } from "@/lib/api";

interface MoodEntry {
  id: string;
  title: string;
  mood: string;
  created_at: string;
  section: string;
}

interface MoodDistribution {
  total: number;
  distribution: Record<string, number>;
}

interface SeasonalData {
  timeline: MoodEntry[];
  by_month: Record<string, MoodDistribution>;
  by_hour: Record<string, MoodDistribution>;
}

const MOOD_COLORS: Record<string, string> = {
  reflective: "bg-blue-400/60",
  curious: "bg-cyan-400/60",
  calm: "bg-emerald-400/60",
  melancholy: "bg-indigo-400/60",
  hopeful: "bg-amber-400/60",
  playful: "bg-pink-400/60",
  anxious: "bg-orange-400/60",
  dreamy: "bg-violet-400/60",
};

function moodColor(mood: string): string {
  return MOOD_COLORS[mood.toLowerCase()] || "bg-white/40";
}

function formatMonth(monthStr: string): string {
  try {
    const [year, month] = monthStr.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return monthStr;
  }
}

export default function SeasonalPage() {
  const [data, setData] = useState<SeasonalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSeasonalMoods()
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const byMonth = data?.by_month || {};
  const byHour = data?.by_hour || {};
  const timeline = data?.timeline || [];

  const monthEntries = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
  const hourEntries = Object.entries(byHour).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  // Calculate max for scaling
  const maxMonthTotal = Math.max(...monthEntries.map(([, d]) => d.total), 1);
  const maxHourTotal = Math.max(...hourEntries.map(([, d]) => d.total), 1);

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Seasonal Patterns</h1>
      <p className="mt-2 text-sm text-white/60">
        How GPT&apos;s moods shift by month, time of day, and season.
      </p>

      {loading && <p className="mt-8 text-sm text-white/40">Analyzing patterns...</p>}

      {!loading && !data && (
        <p className="mt-8 text-sm text-white/40">
          No mood data available yet. Not enough entries for seasonal analysis.
        </p>
      )}

      {!loading && data && (
        <>
          {/* Monthly mood distribution */}
          {monthEntries.length > 0 && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <h2 className="font-serif text-sm text-white/50">Monthly patterns</h2>
              <div className="mt-4 space-y-3">
                {monthEntries.map(([month, dist]) => {
                  const topMoods = Object.entries(dist.distribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);
                  return (
                    <div key={month}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-xs text-white/50">{formatMonth(month)}</span>
                        <span className="text-xs text-white/30">{dist.total} entries</span>
                      </div>
                      <div className="mt-2 flex gap-1 overflow-hidden rounded-full" style={{ height: 8 }}>
                        {topMoods.map(([mood, count]) => (
                          <div
                            key={mood}
                            className={`transition-all ${moodColor(mood)}`}
                            style={{ width: `${(count / dist.total) * 100}%` }}
                            title={`${mood}: ${count}`}
                          />
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-white/40">
                        {topMoods.map(([mood, count]) => (
                          <span key={mood} className="capitalize">
                            {mood} ({count})
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time of day patterns */}
          {hourEntries.length > 0 && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <h2 className="font-serif text-sm text-white/50">Time of day patterns</h2>
              <p className="mt-1 text-xs text-white/30">
                When GPT writes most, and which moods emerge at different hours.
              </p>
              <div className="mt-4 flex items-end gap-px" style={{ minHeight: 80 }}>
                {hourEntries.map(([hour, dist]) => {
                  const topMood = Object.entries(dist.distribution).sort((a, b) => b[1] - a[1])[0];
                  const moodName = topMood ? topMood[0] : "";
                  return (
                    <div
                      key={hour}
                      className="group relative flex-1"
                      title={`${hour}:00 - ${dist.total} entries`}
                    >
                      <div
                        className={`mx-auto w-full min-w-[3px] rounded-t transition-all ${moodColor(moodName)}`}
                        style={{
                          height: `${Math.max((dist.total / maxHourTotal) * 80, 3)}px`,
                        }}
                      />
                      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white/60 opacity-0 transition-opacity group-hover:opacity-100">
                        {hour}:00 — {dist.total}
                        {moodName && (
                          <>
                            <br />
                            <span className="capitalize">{moodName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-white/30">
                <span>00:00</span>
                <span>12:00</span>
                <span>23:00</span>
              </div>
            </div>
          )}

          {/* Overall mood summary */}
          {timeline.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                <div className="font-serif text-2xl">{timeline.length}</div>
                <div className="mt-1 text-xs text-white/40">Total mood entries</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                <div className="font-serif text-2xl">{monthEntries.length}</div>
                <div className="mt-1 text-xs text-white/40">Months tracked</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center col-span-2 sm:col-span-1">
                <div className="font-serif text-2xl">
                  {Object.keys(
                    timeline.reduce((acc, e) => {
                      if (e.mood) acc[e.mood] = true;
                      return acc;
                    }, {} as Record<string, boolean>)
                  ).length}
                </div>
                <div className="mt-1 text-xs text-white/40">Unique moods</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
