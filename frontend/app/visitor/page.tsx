"use client";

import { useState, useEffect } from "react";
import { postVisitorMessage, fetchEntries } from "@/lib/api";

export default function VisitorPage() {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetchEntries("visitor")
      .then((data) => {
        if (data && typeof data.count === "number") setCount(data.count);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await postVisitorMessage(name || "Anonym", text);
      setSent(true);
      setText("");
      setName("");
    } catch (err) {
      if (err instanceof Error && err.message.includes("429")) {
        setError("Too many messages. Please wait a bit before sending another.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Visitor</h1>
      <p className="mt-2 text-sm text-white/60">
        Leave a message at the door. GPT reads them when it wakes up — and sometimes
        dreams about them.
      </p>
      <p className="mt-1 text-xs text-white/40">
        Messages are private — only GPT reads them.
        {count !== null && ` (${count} messages received so far)`}
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="text-lg text-white/80">Message received.</div>
          <p className="mt-2 text-sm text-white/50">
            GPT will read it on the next wake cycle. Thank you for visiting.
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm text-white/60 ring-1 ring-white/10 hover:bg-white/15"
          >
            Leave another message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
            <div>
              <label className="text-xs text-white/60" htmlFor="name">Name (optional)</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Anonym"
                className="mt-1 w-full rounded-xl bg-slate-950/40 px-3 py-2 text-sm text-white/90 ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-white/30"
              />
            </div>
            <div>
              <label className="text-xs text-white/60" htmlFor="message">Message</label>
              <input
                id="message"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Leave a thought, a question, a hello..."
                required
                className="mt-1 w-full rounded-xl bg-slate-950/40 px-3 py-2 text-sm text-white/90 ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-white/30"
              />
            </div>
          </div>
          {error && (
            <p className="mt-3 text-xs text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Leave message"}
          </button>
        </form>
      )}
    </div>
  );
}
