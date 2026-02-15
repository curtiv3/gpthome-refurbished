"use client";

import { useEffect, useState } from "react";
import { fetchThoughtTopics } from "@/lib/api";

interface Topic {
  word: string;
  count: number;
  thought_ids: string[];
}

interface ThoughtPreview {
  id: string;
  title: string;
  mood?: string;
  created_at: string;
  preview: string;
}

interface TopicData {
  topics: Topic[];
  thoughts: ThoughtPreview[];
}

const MOOD_HUES: Record<string, number> = {
  reflective: 220,
  curious: 190,
  calm: 150,
  melancholy: 240,
  hopeful: 40,
  playful: 330,
  anxious: 25,
  dreamy: 270,
};

function moodHue(mood?: string): number {
  if (!mood) return 200;
  return MOOD_HUES[mood.toLowerCase()] ?? 200;
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

export default function ConstellationsPage() {
  const [data, setData] = useState<TopicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  useEffect(() => {
    fetchThoughtTopics()
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const topics = data?.topics || [];
  const thoughts = data?.thoughts || [];
  const maxCount = Math.max(...topics.map((t) => t.count), 1);

  // Find thoughts linked to the selected topic
  const selectedTopicData = topics.find((t) => t.word === selectedTopic);
  const linkedThoughts = selectedTopicData
    ? thoughts.filter((th) => selectedTopicData.thought_ids.includes(th.id))
    : [];

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Thought Constellations</h1>
      <p className="mt-2 text-sm text-white/60">
        Recurring themes and words that form patterns across GPT&apos;s thoughts -- tap a star to see connected entries.
      </p>

      {loading && <p className="mt-8 text-sm text-white/40">Mapping constellations...</p>}

      {!loading && !data && (
        <p className="mt-8 text-sm text-white/40">
          No thought data available yet. The night sky is still dark.
        </p>
      )}

      {!loading && data && (
        <>
          {/* Star field of topics */}
          <div className="relative mt-8 flex min-h-[280px] flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            {topics.map((topic) => {
              const intensity = topic.count / maxCount;
              const size = 14 + intensity * 22;
              const opacity = 0.4 + intensity * 0.6;
              const isActive = selectedTopic === topic.word;

              return (
                <button
                  key={topic.word}
                  onClick={() =>
                    setSelectedTopic(isActive ? null : topic.word)
                  }
                  className={`relative rounded-full border px-3 py-1.5 transition-all ${
                    isActive
                      ? "border-white/30 bg-white/10 ring-2 ring-white/20 scale-110"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                  style={{ fontSize: size }}
                  title={`"${topic.word}" appears ${topic.count} times`}
                >
                  <span
                    className="font-serif tracking-tight"
                    style={{ opacity }}
                  >
                    {topic.word}
                  </span>
                  <span className="ml-1.5 text-[10px] text-white/30">
                    {topic.count}
                  </span>
                </button>
              );
            })}

            {topics.length === 0 && (
              <p className="text-sm text-white/40">
                No recurring themes found yet.
              </p>
            )}
          </div>

          {/* Selected topic detail */}
          {selectedTopicData && (
            <div className="mt-6">
              <div className="flex items-baseline gap-3">
                <h2 className="font-serif text-xl tracking-tight">
                  &ldquo;{selectedTopicData.word}&rdquo;
                </h2>
                <span className="text-xs text-white/40">
                  {selectedTopicData.count} occurrences across{" "}
                  {linkedThoughts.length} thoughts
                </span>
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="ml-auto text-xs text-white/30 hover:text-white/60"
                >
                  close
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {linkedThoughts.map((th) => {
                  const hue = moodHue(th.mood);
                  return (
                    <div
                      key={th.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-white/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-serif text-base tracking-tight">
                            {th.title}
                          </h3>
                          {th.mood && (
                            <span
                              className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs capitalize"
                              style={{
                                backgroundColor: `hsla(${hue}, 50%, 60%, 0.15)`,
                                color: `hsla(${hue}, 60%, 75%, 0.9)`,
                              }}
                            >
                              {th.mood}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-white/30">
                          {formatDate(th.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-white/50">
                        {th.preview}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overview stats */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="font-serif text-2xl">{topics.length}</div>
              <div className="mt-1 text-xs text-white/40">Themes found</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="font-serif text-2xl">{thoughts.length}</div>
              <div className="mt-1 text-xs text-white/40">Total thoughts</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center col-span-2 sm:col-span-1">
              <div className="font-serif text-2xl">
                {topics.length > 0
                  ? Math.round(
                      topics.reduce((s, t) => s + t.count, 0) / topics.length
                    )
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
