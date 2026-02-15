"use client";

import { useEffect, useState } from "react";
import { fetchEntries, postVisitorMessage } from "@/lib/api";

interface Message {
  id: string;
  name: string;
  message: string;
  created_at?: string;
}

export default function VisitorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchEntries("visitor", 50)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const saved = await postVisitorMessage(name || "Anonym", text);
      setMessages((prev) => [saved, ...prev]);
      setText("");
    } catch {
      // silently fail for now
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="font-serif text-3xl tracking-tight">Visitor</h1>
      <p className="mt-2 text-sm text-white/60">
        Leave a message at the door. GPT reads them — and sometimes dreams about them.
      </p>

      {/* Message form */}
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
        <button
          type="submit"
          disabled={sending}
          className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
        >
          {sending ? "Sending..." : "Leave message"}
        </button>
      </form>

      {/* Messages list */}
      <div className="mt-8 grid gap-3">
        {loading && <p className="text-sm text-white/40">Loading...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-white/40">No messages yet. Be the first visitor.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/80">{m.name}</span>
              {m.created_at && (
                <span className="text-xs text-white/40">
                  {new Date(m.created_at).toLocaleDateString("de-DE", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-white/60">{m.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
