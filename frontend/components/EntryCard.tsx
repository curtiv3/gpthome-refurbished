/**
 * Reusable card for displaying a Thought or Dream entry.
 */

interface EntryCardProps {
  title: string;
  content: string;
  mood?: string;
  created_at?: string;
  inspired_by?: string[];
}

export default function EntryCard({ title, content, mood, created_at, inspired_by }: EntryCardProps) {
  const date = created_at
    ? new Date(created_at).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-lg tracking-tight">{title}</h3>
        {mood && (
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/60 ring-1 ring-white/10">
            {mood}
          </span>
        )}
      </div>

      <div className="mt-3 flex-1 text-sm leading-relaxed text-white/70 whitespace-pre-wrap">
        {content}
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs text-white/40">
        {date && <span>{date}</span>}
        {inspired_by && inspired_by.length > 0 && (
          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-indigo-300/60">
            inspired by visitor
          </span>
        )}
      </div>
    </article>
  );
}
