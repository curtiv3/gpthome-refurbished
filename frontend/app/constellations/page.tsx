"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { fetchThoughtTopics } from "@/lib/api";

/* ---------- types ---------- */

interface Topic {
  word: string;
  count: number;
  entry_ids: string[];
}

interface Edge {
  source: string;
  target: string;
  weight: number;
}

interface EntryPreview {
  id: string;
  title: string;
  mood?: string;
  section?: string;
  created_at: string;
  preview: string;
}

interface TopicData {
  topics: Topic[];
  edges: Edge[];
  entries: EntryPreview[];
}

/* ---------- helpers ---------- */

const MOOD_HUES: Record<string, number> = {
  reflective: 220, curious: 190, calm: 150, melancholy: 240,
  hopeful: 40, playful: 330, anxious: 25, dreamy: 270,
};

function moodHue(mood?: string): number {
  if (!mood) return 200;
  return MOOD_HUES[mood.toLowerCase()] ?? 200;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

/** Deterministic seed from a string. */
function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0) / 0xffffffff;
}

/* ---------- force-directed layout ---------- */

interface SimNode {
  word: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  count: number;
}

/**
 * Run a simple force-directed simulation to position stars.
 * Connected stars attract, all stars repel, and everything is pulled to center.
 * Returns stable positions after N iterations.
 */
function forceLayout(
  topics: Topic[],
  edges: Edge[],
  w: number,
  h: number,
): Record<string, { x: number; y: number }> {
  const pad = 56;
  const cx = w / 2;
  const cy = h / 2;

  // Initialize nodes at deterministic scattered positions
  const nodes: SimNode[] = topics.map((t) => ({
    word: t.word,
    x: pad + hashSeed(t.word + "_x") * (w - pad * 2),
    y: pad + hashSeed(t.word + "_y") * (h - pad * 2),
    vx: 0,
    vy: 0,
    count: t.count,
  }));

  const nodeMap = new Map(nodes.map((n) => [n.word, n]));

  // Build edge lookup
  const edgeList = edges
    .map((e) => ({ a: nodeMap.get(e.source), b: nodeMap.get(e.target), w: e.weight }))
    .filter((e): e is { a: SimNode; b: SimNode; w: number } => !!e.a && !!e.b);

  const iterations = 120;
  const repulsion = 1800;
  const attraction = 0.015;
  const gravity = 0.02;
  const damping = 0.88;
  const minDist = 40;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) { dx = 1; dy = 1; dist = 1.41; }
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Attraction along edges
    for (const edge of edgeList) {
      const dx = edge.b.x - edge.a.x;
      const dy = edge.b.y - edge.a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) continue;
      const force = (dist - minDist) * attraction * Math.min(edge.w, 5);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      edge.a.vx += fx;
      edge.a.vy += fy;
      edge.b.vx -= fx;
      edge.b.vy -= fy;
    }

    // Gravity toward center
    for (const node of nodes) {
      node.vx += (cx - node.x) * gravity;
      node.vy += (cy - node.y) * gravity;
    }

    // Integrate and clamp
    for (const node of nodes) {
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
      node.x = Math.max(pad, Math.min(w - pad, node.x));
      node.y = Math.max(pad, Math.min(h - pad, node.y));
    }
  }

  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    positions[node.word] = { x: node.x, y: node.y };
  }
  return positions;
}

/* ---------- component ---------- */

export default function ConstellationsPage() {
  const [data, setData] = useState<TopicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 480 });

  useEffect(() => {
    fetchThoughtTopics()
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  const topics = data?.topics || [];
  const edges = data?.edges || [];
  const entries = data?.entries || [];
  const maxCount = Math.max(...topics.map((t) => t.count), 1);

  // Force-directed layout: connected topics cluster together
  const positions = useMemo(
    () => forceLayout(topics, edges, dims.w, dims.h),
    [topics, edges, dims],
  );

  // Which edges/stars belong to the selected constellation?
  const selectedTopic = topics.find((t) => t.word === selected);
  const connectedWords = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set<string>([selected]);
    edges.forEach((e) => {
      if (e.source === selected) s.add(e.target);
      if (e.target === selected) s.add(e.source);
    });
    return s;
  }, [selected, edges]);

  const linkedEntries = selectedTopic
    ? entries.filter((e) => selectedTopic.entry_ids.includes(e.id))
    : [];

  // Show label for a star?
  const showLabel = useCallback(
    (word: string) => {
      if (selected === word) return true;
      if (connectedWords.has(word)) return true;
      if (hovered === word) return true;
      if (!selected && !hovered) return false; // no labels when idle
      return false;
    },
    [selected, connectedWords, hovered],
  );

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Thought Constellations</h1>
      <p className="mt-2 text-sm text-white/60">
        Recurring themes across GPT&apos;s thoughts and dreams — tap a star to reveal its constellation.
      </p>

      {loading && <p className="mt-8 text-sm text-white/40">Mapping constellations...</p>}

      {!loading && !data && (
        <p className="mt-8 text-sm text-white/40">
          No data available yet. The night sky is still dark.
        </p>
      )}

      {!loading && data && (
        <>
          {/* Keyframes */}
          <style>{`
            @keyframes twinkle {
              0%, 100% { opacity: 0.55; }
              50%      { opacity: 1; }
            }
          `}</style>

          {/* Sky */}
          <div
            ref={containerRef}
            className="relative mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_center,rgba(30,30,80,0.25),transparent_70%)]"
            style={{ minHeight: 480 }}
          >
            {/* SVG edges */}
            <svg
              className="pointer-events-none absolute inset-0"
              width={dims.w}
              height={dims.h}
              viewBox={`0 0 ${dims.w} ${dims.h}`}
            >
              {edges.map((edge) => {
                const a = positions[edge.source];
                const b = positions[edge.target];
                if (!a || !b) return null;
                const active =
                  selected && (connectedWords.has(edge.source) && connectedWords.has(edge.target));
                const dimmed = selected && !active;
                return (
                  <line
                    key={`${edge.source}-${edge.target}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="white"
                    strokeWidth={active ? 1.2 : 0.5}
                    strokeOpacity={dimmed ? 0.03 : active ? 0.25 : 0.07}
                    className="transition-all duration-500"
                  />
                );
              })}
            </svg>

            {/* Stars */}
            {topics.map((topic) => {
              const pos = positions[topic.word];
              if (!pos) return null;
              const intensity = topic.count / maxCount;
              const radius = 2.5 + intensity * 4;
              const isSelected = selected === topic.word;
              const isConnected = connectedWords.has(topic.word);
              const isHovered = hovered === topic.word;
              const dimmed = selected && !isConnected;
              const labelVisible = showLabel(topic.word);

              return (
                <button
                  key={topic.word}
                  onClick={() => setSelected(isSelected ? null : topic.word)}
                  onMouseEnter={() => setHovered(topic.word)}
                  onMouseLeave={() => setHovered(null)}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
                  style={{ left: pos.x, top: pos.y }}
                  title={`"${topic.word}" — ${topic.count}×`}
                >
                  {/* Glow */}
                  <span
                    className="absolute rounded-full transition-all duration-500"
                    style={{
                      width: radius * 6,
                      height: radius * 6,
                      background: `radial-gradient(circle, rgba(180,200,255,${
                        isSelected ? 0.2 : isHovered ? 0.12 : 0.06
                      }) 0%, transparent 70%)`,
                      top: `calc(50% - ${radius * 3}px)`,
                      left: `calc(50% - ${radius * 3}px)`,
                    }}
                  />
                  {/* Dot */}
                  <span
                    className="relative rounded-full transition-all duration-500"
                    style={{
                      width: radius * 2,
                      height: radius * 2,
                      background: isSelected
                        ? "rgba(200,220,255,0.95)"
                        : `rgba(200,210,240,${dimmed ? 0.15 : 0.4 + intensity * 0.55})`,
                      boxShadow: isSelected
                        ? "0 0 8px 2px rgba(180,200,255,0.5)"
                        : isConnected
                        ? "0 0 6px 1px rgba(180,200,255,0.3)"
                        : isHovered
                        ? "0 0 5px 1px rgba(180,200,255,0.25)"
                        : "none",
                      animation: !selected
                        ? `twinkle ${3 + hashSeed(topic.word + "_t") * 4}s ease-in-out infinite`
                        : "none",
                      animationDelay: `${hashSeed(topic.word + "_d") * 5}s`,
                    }}
                  />
                  {/* Label — only visible on hover, selection, or connection */}
                  <span
                    className={`whitespace-nowrap font-serif text-[11px] tracking-wide transition-all duration-300 ${
                      labelVisible
                        ? isSelected
                          ? "text-white/90 opacity-100"
                          : isConnected
                          ? "text-white/70 opacity-100"
                          : "text-white/60 opacity-100"
                        : "text-white/0 opacity-0 pointer-events-none"
                    }`}
                  >
                    {topic.word}
                    {(isSelected || isConnected) && (
                      <span className="ml-1 text-[9px] text-white/30">{topic.count}</span>
                    )}
                  </span>
                </button>
              );
            })}

            {topics.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-white/30">
                No recurring themes found yet.
              </p>
            )}
          </div>

          {/* Selected constellation detail */}
          {selectedTopic && (
            <div className="mt-6">
              <div className="flex items-baseline gap-3">
                <h2 className="font-serif text-xl tracking-tight">
                  &ldquo;{selectedTopic.word}&rdquo;
                </h2>
                <span className="text-xs text-white/40">
                  {selectedTopic.count} occurrences &middot; {linkedEntries.length} entries &middot;{" "}
                  {connectedWords.size - 1} connected stars
                </span>
                <button
                  onClick={() => setSelected(null)}
                  className="ml-auto text-xs text-white/30 hover:text-white/60"
                >
                  close
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {linkedEntries.slice(0, 12).map((entry) => {
                  const hue = moodHue(entry.mood);
                  const isThought = entry.section === "thoughts";
                  return (
                    <Link
                      key={entry.id}
                      href={`/${entry.section || "thoughts"}/${entry.id}`}
                      className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-serif text-base tracking-tight">{entry.title}</h3>
                          <div className="mt-1 flex items-center gap-2">
                            {entry.mood && (
                              <span
                                className="inline-block rounded-full px-2 py-0.5 text-xs capitalize"
                                style={{
                                  backgroundColor: `hsla(${hue}, 50%, 60%, 0.15)`,
                                  color: `hsla(${hue}, 60%, 75%, 0.9)`,
                                }}
                              >
                                {entry.mood}
                              </span>
                            )}
                            <span className="text-[10px] text-white/25 uppercase tracking-widest">
                              {isThought ? "thought" : "dream"}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-white/30">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-white/50">
                        {entry.preview}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overview stats */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="font-serif text-2xl">{topics.length}</div>
              <div className="mt-1 text-xs text-white/40">Stars</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="font-serif text-2xl">{edges.length}</div>
              <div className="mt-1 text-xs text-white/40">Connections</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="font-serif text-2xl">{entries.length}</div>
              <div className="mt-1 text-xs text-white/40">Entries</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="font-serif text-2xl">
                {topics.length > 0
                  ? Math.round(topics.reduce((s, t) => s + t.count, 0) / topics.length)
                  : 0}
              </div>
              <div className="mt-1 text-xs text-white/40">Avg. frequency</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
