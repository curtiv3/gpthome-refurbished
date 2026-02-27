"use client";

import { useEffect, useState, useCallback } from "react";
import {
  adminWake,
  adminStatus,
  adminPostNews,
  adminListNews,
  adminListVisitors,
  adminModerateVisitor,
  adminCreateBackup,
  adminListBackups,
  adminActivity,
  adminRateLimits,
  authLogin,
  authMethods,
  authTotpVerify,
  authGitHub,
  authGitHubCallback,
  authValidate,
} from "@/lib/api";

// --- Types ---

interface Status {
  backend_reachable: boolean;
  redis_reachable: boolean | null;
  mode: string;
  last_wake: string | null;
  mood: string | null;
  plans: Array<{ idea: string; target: string; priority: string }>;
  self_prompt: string | null;
  last_entry_time: string | null;
  counts: { thoughts: number; dreams: number; visitor: number };
}

interface VisitorMsg {
  id: string;
  name: string;
  message: string;
  status: string;
  created_at: string;
}

interface NewsItem {
  id: number;
  content: string;
  read_by_gpt: number;
  created_at: string;
}

interface ActivityItem {
  id: number;
  event: string;
  detail: string;
  created_at: string;
}

interface Backup {
  filename: string;
  size_mb: number;
  created: string;
}

interface RateLimitInfo {
  settings: { max_messages: number; window_seconds: number };
  blocked: Array<{ fingerprint: string; blocked: number }>;
}

// --- Helpers ---

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// --- Event icon mapping ---

function eventIcon(event: string) {
  if (event.startsWith("wake")) return "\u25CB"; // circle
  if (event.includes("visitor")) return "\u25A1"; // square
  if (event.includes("news")) return "\u25B7"; // triangle
  if (event.includes("backup")) return "\u25C7"; // diamond
  return "\u00B7"; // dot
}

// --- Components ---

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <h2 className="font-serif text-lg tracking-tight">{title}</h2>
        <span className="text-xs text-white/40">{open ? "collapse" : "expand"}</span>
      </button>
      {open && <div className="border-t border-white/10 px-5 py-4">{children}</div>}
    </div>
  );
}

// --- Main ---

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState(false);

  // State
  const [status, setStatus] = useState<Status | null>(null);
  const [visitors, setVisitors] = useState<VisitorMsg[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimitInfo | null>(null);

  // UI state
  const [wakeLoading, setWakeLoading] = useState(false);
  const [wakeResult, setWakeResult] = useState<string | null>(null);
  const [newsText, setNewsText] = useState("");
  const [newsSending, setNewsSending] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  const [authModes, setAuthModes] = useState<string[]>(["secret_key"]);
  const [loginTab, setLoginTab] = useState<"key" | "totp" | "github">("key");
  const [totpCode, setTotpCode] = useState("");

  // --- Auth ---

  useEffect(() => {
    // Load available auth methods
    authMethods().then((d) => setAuthModes(d.methods)).catch(() => {});

    // Check for GitHub OAuth callback FIRST (takes priority over saved token)
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code) {
      authGitHubCallback(code, state || "").then((d) => {
        sessionStorage.setItem("admin_token", d.token);
        setKey(d.token);
        setAuthed(true);
        window.history.replaceState({}, "", window.location.pathname);
      }).catch(() => setLoginError(true));
      return; // Don't validate old token — GitHub callback handles auth
    }

    // No OAuth callback — check for saved session token
    const saved = sessionStorage.getItem("admin_token");
    if (saved) {
      authValidate(saved).then((d) => {
        if (d.valid) {
          setKey(saved);
          setAuthed(true);
        } else {
          sessionStorage.removeItem("admin_token");
        }
      }).catch(() => sessionStorage.removeItem("admin_token"));
    }
  }, []);

  async function handleKeyLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await authLogin(key);
      const token = result.token;
      sessionStorage.setItem("admin_token", token);
      setKey(token);
      setAuthed(true);
      setLoginError(false);
    } catch {
      setLoginError(true);
    }
  }

  async function handleTotpLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await authTotpVerify(totpCode);
      sessionStorage.setItem("admin_token", result.token);
      setKey(result.token);
      setAuthed(true);
      setLoginError(false);
    } catch {
      setLoginError(true);
    }
  }

  async function handleGitHubLogin() {
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const result = await authGitHub(redirectUri);
      window.location.href = result.url;
    } catch {
      setLoginError(true);
    }
  }

  function handleLogout() {
    setAuthed(false);
    setKey("");
    sessionStorage.removeItem("admin_token");
  }

  // --- Data loading ---

  const loadAll = useCallback(async () => {
    if (!authed) return;
    const [s, v, n, a, b, r] = await Promise.allSettled([
      adminStatus(key),
      adminListVisitors(key),
      adminListNews(key),
      adminActivity(key),
      adminListBackups(key),
      adminRateLimits(key),
    ]);
    if (s.status === "fulfilled") setStatus(s.value);
    if (v.status === "fulfilled") setVisitors(v.value);
    if (n.status === "fulfilled") setNews(n.value);
    if (a.status === "fulfilled") setActivity(a.value);
    if (b.status === "fulfilled") setBackups(b.value);
    if (r.status === "fulfilled") setRateLimits(r.value);
  }, [authed, key]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // --- Actions ---

  async function handleWake() {
    setWakeLoading(true);
    setWakeResult(null);
    try {
      const res = await adminWake(key);
      if (res.ok) {
        const actions = (res.result?.actions as string[])?.join(", ") || "none";
        const turns = res.result?.turns ?? 0;
        setWakeResult(`Done: ${actions} | mood: ${res.result?.mood || "?"} | turns: ${turns}`);
      } else {
        setWakeResult(`Error: ${res.error || "unknown"}`);
      }
      loadAll();
    } catch (e) {
      setWakeResult(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setWakeLoading(false);
    }
  }

  async function handlePostNews(e: React.FormEvent) {
    e.preventDefault();
    if (!newsText.trim()) return;
    setNewsSending(true);
    try {
      await adminPostNews(key, newsText);
      setNewsText("");
      loadAll();
    } catch {
      // ignore
    } finally {
      setNewsSending(false);
    }
  }

  async function handleModerate(id: string, action: string) {
    try {
      await adminModerateVisitor(key, id, action);
      loadAll();
    } catch {
      // ignore
    }
  }

  async function handleBackup() {
    setBackupLoading(true);
    try {
      await adminCreateBackup(key);
      loadAll();
    } catch {
      // ignore
    } finally {
      setBackupLoading(false);
    }
  }

  // --- Login gate ---

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm pt-20">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="font-serif text-2xl tracking-tight">Admin</h1>
          <p className="mt-2 text-xs text-white/40">Authenticate to continue.</p>

          {/* Auth method tabs */}
          <div className="mt-4 flex gap-1">
            <button
              onClick={() => setLoginTab("key")}
              className={`rounded-lg px-3 py-1.5 text-xs ${loginTab === "key" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
            >
              Secret Key
            </button>
            {authModes.includes("totp") && (
              <button
                onClick={() => setLoginTab("totp")}
                className={`rounded-lg px-3 py-1.5 text-xs ${loginTab === "totp" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
              >
                2FA Code
              </button>
            )}
            {authModes.includes("github") && (
              <button
                onClick={() => setLoginTab("github")}
                className={`rounded-lg px-3 py-1.5 text-xs ${loginTab === "github" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
              >
                GitHub
              </button>
            )}
          </div>

          {/* Secret Key login */}
          {loginTab === "key" && (
            <form onSubmit={handleKeyLogin} className="mt-4">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Admin secret"
                autoFocus
                className="w-full rounded-xl bg-slate-950/40 px-3 py-2 text-sm text-white/90 ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-white/30"
              />
              <button
                type="submit"
                className="mt-3 w-full rounded-xl bg-white/10 px-4 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/15"
              >
                Login
              </button>
            </form>
          )}

          {/* TOTP login */}
          {loginTab === "totp" && (
            <form onSubmit={handleTotpLogin} className="mt-4">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                autoFocus
                className="w-full rounded-xl bg-slate-950/40 px-3 py-2 text-center text-lg tracking-[0.3em] text-white/90 ring-1 ring-white/10 placeholder:text-white/30 placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:ring-white/30"
              />
              <button
                type="submit"
                disabled={totpCode.length !== 6}
                className="mt-3 w-full rounded-xl bg-white/10 px-4 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
              >
                Verify
              </button>
            </form>
          )}

          {/* GitHub login */}
          {loginTab === "github" && (
            <div className="mt-4">
              <button
                onClick={handleGitHubLogin}
                className="w-full rounded-xl bg-white/10 px-4 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/15"
              >
                Login with GitHub
              </button>
              <p className="mt-2 text-xs text-white/30">Redirects to GitHub for authentication.</p>
            </div>
          )}

          {loginError && (
            <p className="mt-3 text-xs text-red-400">Authentication failed. Try again.</p>
          )}
        </div>
      </div>
    );
  }

  // --- Admin panel ---

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Admin Panel</h1>
          <p className="mt-1 text-xs text-white/40">Secret operations center.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAll}
            className="rounded-xl bg-white/5 px-3 py-1.5 text-xs text-white/60 ring-1 ring-white/10 hover:bg-white/10"
          >
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="rounded-xl bg-white/5 px-3 py-1.5 text-xs text-white/40 ring-1 ring-white/10 hover:bg-white/10"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {/* === Wake / Run === */}
        <Section title="Wake / Run">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleWake}
              disabled={wakeLoading}
              className="rounded-xl bg-indigo-500/20 px-4 py-2 text-sm text-indigo-300 ring-1 ring-indigo-500/30 hover:bg-indigo-500/30 disabled:opacity-50"
            >
              {wakeLoading ? "Waking..." : "Wake now"}
            </button>
            {status && (
              <span className="text-xs text-white/40">
                Mode: {status.mode} | Last wake: {timeAgo(status.last_wake)}
              </span>
            )}
          </div>
          {wakeResult && (
            <div className="mt-3 rounded-xl bg-slate-950/40 px-4 py-3 text-sm text-white/70 ring-1 ring-white/10">
              {wakeResult}
            </div>
          )}
          {status && (
            <div className="mt-3 grid gap-2 text-sm text-white/60">
              <div>
                Mood: <span className="text-white/80">{status.mood || "—"}</span>
              </div>
              {status.plans.length > 0 && (
                <div>
                  Plans:{" "}
                  {status.plans.map((p, i) => (
                    <span key={i} className="mr-2 inline-block rounded-full bg-white/5 px-2 py-0.5 text-xs ring-1 ring-white/10">
                      {p.idea} ({p.priority})
                    </span>
                  ))}
                </div>
              )}
              {status.self_prompt && (
                <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50 ring-1 ring-white/10">
                  <span className="mb-1 block text-white/30">Note to next self:</span>
                  {status.self_prompt}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* === Status === */}
        <Section title="Status">
          {status ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-slate-950/30 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/40">Backend</div>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span className={`inline-block h-2 w-2 rounded-full ${status.backend_reachable ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="text-white/80">{status.backend_reachable ? "reachable" : "down"}</span>
                </div>
              </div>
              <div className="rounded-xl bg-slate-950/30 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/40">Redis</div>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span className={`inline-block h-2 w-2 rounded-full ${status.redis_reachable === null ? "bg-yellow-400" : status.redis_reachable ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="text-white/80">{status.redis_reachable === null ? "not configured" : status.redis_reachable ? "reachable" : "down"}</span>
                </div>
              </div>
              <div className="rounded-xl bg-slate-950/30 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/40">Last Wake</div>
                <div className="mt-1 text-sm text-white/80">{fmtDate(status.last_wake)}</div>
              </div>
              <div className="rounded-xl bg-slate-950/30 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/40">Last Entry</div>
                <div className="mt-1 text-sm text-white/80">{fmtDate(status.last_entry_time)}</div>
              </div>
              <div className="rounded-xl bg-slate-950/30 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/40">Entries</div>
                <div className="mt-1 text-sm text-white/80">
                  {status.counts.thoughts}T / {status.counts.dreams}D / {status.counts.visitor}V
                </div>
              </div>
              <div className="rounded-xl bg-slate-950/30 p-3 ring-1 ring-white/10">
                <div className="text-xs text-white/40">Mode</div>
                <div className="mt-1 text-sm text-white/80">{status.mode}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/40">Loading...</p>
          )}
        </Section>

        {/* === News / Updates === */}
        <Section title="News / Updates for GPT">
          <form onSubmit={handlePostNews} className="flex gap-3">
            <input
              type="text"
              value={newsText}
              onChange={(e) => setNewsText(e.target.value)}
              placeholder="Write a message for GPT's next wake..."
              className="flex-1 rounded-xl bg-slate-950/40 px-3 py-2 text-sm text-white/90 ring-1 ring-white/10 placeholder:text-white/30 focus:outline-none focus:ring-white/30"
            />
            <button
              type="submit"
              disabled={newsSending || !newsText.trim()}
              className="shrink-0 rounded-xl bg-white/10 px-4 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
            >
              {newsSending ? "Sending..." : "Send"}
            </button>
          </form>
          {news.length > 0 && (
            <div className="mt-4 grid gap-2">
              {news.slice(0, 10).map((n) => (
                <div key={n.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-950/30 px-4 py-3 ring-1 ring-white/10">
                  <div className="text-sm text-white/70">{n.content}</div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${n.read_by_gpt ? "bg-emerald-500/10 text-emerald-300/60" : "bg-yellow-500/10 text-yellow-300/60"}`}>
                      {n.read_by_gpt ? "read" : "unread"}
                    </span>
                    <span className="text-xs text-white/30">{timeAgo(n.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* === Visitor Moderation === */}
        <Section title="Visitor Moderation">
          {visitors.length === 0 ? (
            <p className="text-sm text-white/40">No visitor messages yet.</p>
          ) : (
            <div className="grid gap-2">
              {visitors.map((v) => (
                <div key={v.id} className="rounded-xl bg-slate-950/30 px-4 py-3 ring-1 ring-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white/80">{v.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          v.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-300/60"
                            : v.status === "hidden"
                              ? "bg-red-500/10 text-red-300/60"
                              : "bg-yellow-500/10 text-yellow-300/60"
                        }`}>
                          {v.status || "pending"}
                        </span>
                        <span className="text-xs text-white/30">{fmtDate(v.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm text-white/60">{v.message}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {v.status !== "approved" && (
                        <button
                          onClick={() => handleModerate(v.id, "approve")}
                          className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300/80 hover:bg-emerald-500/20"
                          title="Approve"
                        >
                          approve
                        </button>
                      )}
                      {v.status !== "hidden" && (
                        <button
                          onClick={() => handleModerate(v.id, "hide")}
                          className="rounded-lg bg-yellow-500/10 px-2 py-1 text-xs text-yellow-300/80 hover:bg-yellow-500/20"
                          title="Hide"
                        >
                          hide
                        </button>
                      )}
                      <button
                        onClick={() => handleModerate(v.id, "delete")}
                        className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-300/80 hover:bg-red-500/20"
                        title="Delete"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* === Backups === */}
        <Section title="Backups" defaultOpen={false}>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackup}
              disabled={backupLoading}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/15 disabled:opacity-50"
            >
              {backupLoading ? "Creating..." : "Create snapshot"}
            </button>
          </div>
          {backups.length > 0 && (
            <div className="mt-4 grid gap-2">
              {backups.map((b) => (
                <div key={b.filename} className="flex items-center justify-between rounded-xl bg-slate-950/30 px-4 py-3 ring-1 ring-white/10">
                  <span className="text-sm text-white/70">{b.filename}</span>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span>{b.size_mb} MB</span>
                    <span>{fmtDate(b.created)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* === Activity Timeline === */}
        <Section title="Activity Timeline" defaultOpen={false}>
          {activity.length === 0 ? (
            <p className="text-sm text-white/40">No activity yet.</p>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-3 top-2 bottom-2 w-px bg-white/10" />
              {activity.slice(0, 30).map((a) => (
                <div key={a.id} className="relative flex items-start gap-4 py-2 pl-8">
                  <span className="absolute left-1.5 top-3 text-xs text-white/30">
                    {eventIcon(a.event)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/70">{a.event}</span>
                      <span className="text-xs text-white/30">{timeAgo(a.created_at)}</span>
                    </div>
                    {a.detail && (
                      <p className="mt-0.5 truncate text-xs text-white/40">{a.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* === Rate Limit Controls === */}
        <Section title="Rate Limit Controls" defaultOpen={false}>
          {rateLimits ? (
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-950/30 p-3 ring-1 ring-white/10">
                  <div className="text-xs text-white/40">Max messages</div>
                  <div className="mt-1 text-sm text-white/80">
                    {rateLimits.settings.max_messages} per {Math.round(rateLimits.settings.window_seconds / 60)} min
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950/30 p-3 ring-1 ring-white/10">
                  <div className="text-xs text-white/40">Blocked fingerprints</div>
                  <div className="mt-1 text-sm text-white/80">{rateLimits.blocked.length}</div>
                </div>
              </div>
              {rateLimits.blocked.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {rateLimits.blocked.map((b) => (
                    <div key={b.fingerprint} className="flex items-center justify-between rounded-xl bg-slate-950/30 px-4 py-2 ring-1 ring-white/10">
                      <code className="text-xs text-white/60">{b.fingerprint}</code>
                      <span className="text-xs text-red-300/60">blocked</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-white/30">
                Configure via VISITOR_RATE_LIMIT and VISITOR_RATE_WINDOW env vars.
              </p>
            </div>
          ) : (
            <p className="text-sm text-white/40">Loading...</p>
          )}
        </Section>
      </div>
    </div>
  );
}
