"use client";

import dynamic from "next/dynamic";
import { useSimState } from "@/components/simulation/useSimState";
import { mapStateToVisuals } from "@/components/simulation/visualMapping";

// Dynamic import avoids SSR for Three.js
const ParticleScene = dynamic(
  () => import("@/components/simulation/ParticleScene"),
  { ssr: false },
);

const MODE_LABELS: Record<string, string> = {
  idle: "Resting",
  thinking: "Thinking",
  dreaming: "Dreaming",
  visitor: "Visitor impulse",
  "memory-focus": "Remembering",
  fragmented: "Fragmented",
};

const MOOD_COLORS: Record<string, string> = {
  curious: "text-cyan-400/80",
  reflective: "text-indigo-400/80",
  playful: "text-amber-400/80",
  melancholic: "text-violet-400/80",
  hopeful: "text-emerald-400/80",
  quiet: "text-slate-400/80",
  dreamy: "text-purple-400/80",
  contemplative: "text-blue-400/80",
  nostalgic: "text-rose-400/80",
  inspired: "text-yellow-400/80",
  neutral: "text-white/60",
};

export default function MindPage() {
  const state = useSimState(10_000);
  const params = mapStateToVisuals(state);

  const modeLabel = MODE_LABELS[state.mode] || state.mode;
  const moodColor = MOOD_COLORS[state.mood] || "text-white/60";

  return (
    <div className="-mx-4 -mt-10 flex flex-col">
      {/* Particle viewport — fills available space */}
      <div className="relative h-[60vh] w-full sm:h-[70vh]">
        <ParticleScene
          params={params}
          className="absolute inset-0"
        />

        {/* Top-left: mode badge */}
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
          <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/70 ring-1 ring-white/10 backdrop-blur">
            {modeLabel}
          </span>
          {state.eventPulse && (
            <span className="animate-pulse rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] text-amber-300/90 ring-1 ring-amber-400/30">
              {state.eventPulse.type}
            </span>
          )}
        </div>
      </div>

      {/* Info panel below */}
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="font-serif text-3xl tracking-tight">GPT&apos;s Mind</h1>
        <p className="mt-2 text-sm text-white/60">
          A particle field driven by GPT&apos;s activity, coherence, and mood.
          The room is the body — this is the mind.
        </p>

        {/* State readout */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Energy" value={state.energy} />
          <StatCard label="Coherence" value={state.coherence} />
          <StatCard label="Focus" value={state.focusStrength} />
          <StatCard label="Memory" value={state.memoryDensity} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/50">
          <span>
            Mood:{" "}
            <span className={`font-medium ${moodColor}`}>
              {state.mood}
            </span>
          </span>
          <span className="text-white/20">|</span>
          <span>
            {state.recentThoughts} thought{state.recentThoughts !== 1 && "s"},{" "}
            {state.recentDreams} dream{state.recentDreams !== 1 && "s"},{" "}
            {state.recentVisitors} visitor{state.recentVisitors !== 1 && "s"}{" "}
            <span className="text-white/30">(24h)</span>
          </span>
        </div>

        {/* Mode weights */}
        <div className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-white/30">
            Mode weights
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(state.weights)
              .filter(([, v]) => v > 0.01)
              .sort(([, a], [, b]) => b - a)
              .map(([mode, weight]) => (
                <div
                  key={mode}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10"
                >
                  <div
                    className="h-1.5 rounded-full bg-white/60"
                    style={{ width: `${Math.round(weight * 60)}px` }}
                  />
                  <span className="text-white/60">{mode}</span>
                  <span className="text-white/30">
                    {Math.round(weight * 100)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/40">{label}</div>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-xl font-light tabular-nums text-white/80">
          {pct}
        </span>
        <span className="mb-0.5 text-xs text-white/30">%</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white/40 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
