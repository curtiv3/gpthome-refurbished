/**
 * GPT Home — API Client
 *
 * Simple fetch wrapper for talking to the FastAPI backend.
 */

const API_BASE = "/api";

export async function fetchEntries(section: string, limit = 20, offset = 0) {
  const res = await fetch(`${API_BASE}/${section}?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`Failed to fetch ${section}`);
  return res.json();
}

export async function fetchEntry(section: string, id: string) {
  const res = await fetch(`${API_BASE}/${section}/${id}`);
  if (!res.ok) throw new Error(`Entry not found: ${id}`);
  return res.json();
}

export async function postVisitorMessage(name: string, message: string) {
  const res = await fetch(`${API_BASE}/visitor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, message }),
  });
  if (!res.ok) throw new Error("Failed to post message");
  return res.json();
}

export async function fetchEchoes(limit = 20): Promise<{ echoes: { id: string; content: string; created_at: string }[]; count: number }> {
  const res = await fetch(`${API_BASE}/echoes?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch echoes");
  return res.json();
}

export async function fetchPlaygroundProjects() {
  const res = await fetch(`${API_BASE}/playground`);
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function fetchPlaygroundFile(project: string, filename: string) {
  const res = await fetch(`${API_BASE}/playground/${project}/${filename}`);
  if (!res.ok) throw new Error("File not found");
  return res.text();
}

// --- Admin API ---

function adminHeaders(key: string): HeadersInit {
  // Session tokens are longer (64+ chars) vs secret keys
  if (key.length > 50) {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    };
  }
  return {
    "Content-Type": "application/json",
    "X-Admin-Key": key,
  };
}

/** Clear saved session and reload when the backend rejects our token. */
function handleExpiredSession(): never {
  sessionStorage.removeItem("admin_token");
  window.location.reload();
  throw new Error("session_expired");
}

/** Throw if the response is a 403 (token expired / invalid). */
function checkAuth(res: Response): void {
  if (res.status === 403) handleExpiredSession();
}

export async function adminWake(key: string) {
  const res = await fetch(`${API_BASE}/admin/wake`, {
    method: "POST",
    headers: adminHeaders(key),
  });
  checkAuth(res);
  if (!res.ok) throw new Error("Wake failed");
  return res.json();
}

export async function adminStatus(key: string) {
  const res = await fetch(`${API_BASE}/admin/status`, {
    headers: adminHeaders(key),
  });
  checkAuth(res);
  if (!res.ok) throw new Error("Status fetch failed");
  return res.json();
}

export async function adminPostNews(key: string, content: string) {
  const res = await fetch(`${API_BASE}/admin/news`, {
    method: "POST",
    headers: adminHeaders(key),
    body: JSON.stringify({ content }),
  });
  checkAuth(res);
  if (!res.ok) throw new Error("News post failed");
  return res.json();
}

export async function adminListNews(key: string) {
  const res = await fetch(`${API_BASE}/admin/news`, {
    headers: adminHeaders(key),
  });
  checkAuth(res);
  if (!res.ok) throw new Error("News fetch failed");
  return res.json();
}

export async function adminListVisitors(key: string, limit = 100) {
  const res = await fetch(`${API_BASE}/admin/visitors?limit=${limit}`, {
    headers: adminHeaders(key),
  });
  checkAuth(res);
  if (!res.ok) throw new Error("Visitors fetch failed");
  return res.json();
}

export async function adminModerateVisitor(key: string, id: string, action: string) {
  const res = await fetch(`${API_BASE}/admin/visitors/${id}`, {
    method: "PATCH",
    headers: adminHeaders(key),
    body: JSON.stringify({ action }),
  });
  checkAuth(res);
  if (!res.ok) throw new Error("Moderate failed");
  return res.json();
}

export async function adminBanVisitor(key: string, fingerprint: string) {
  const res = await fetch(`${API_BASE}/admin/visitors/ban`, {
    method: "POST",
    headers: adminHeaders(key),
    body: JSON.stringify({ fingerprint }),
  });
  checkAuth(res);
  if (!res.ok) throw new Error("Ban failed");
  return res.json();
}

export async function adminCreateBackup(key: string) {
  const res = await fetch(`${API_BASE}/admin/backup`, {
    method: "POST",
    headers: adminHeaders(key),
  });
  checkAuth(res);
  if (!res.ok) throw new Error("Backup failed");
  return res.json();
}

export async function adminListBackups(key: string) {
  const res = await fetch(`${API_BASE}/admin/backups`, {
    headers: adminHeaders(key),
  });
  checkAuth(res);
  if (!res.ok) throw new Error("Backups fetch failed");
  return res.json();
}

export async function adminActivity(key: string, limit = 50) {
  const res = await fetch(`${API_BASE}/admin/activity?limit=${limit}`, {
    headers: adminHeaders(key),
  });
  checkAuth(res);
  if (!res.ok) throw new Error("Activity fetch failed");
  return res.json();
}

export async function adminRateLimits(key: string) {
  const res = await fetch(`${API_BASE}/admin/rate-limits`, {
    headers: adminHeaders(key),
  });
  checkAuth(res);
  if (!res.ok) throw new Error("Rate limits fetch failed");
  return res.json();
}

// --- Auth API ---

export async function authLogin(key: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (res.status === 403) throw new Error("unauthorized");
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

export async function authMethods() {
  const res = await fetch(`${API_BASE}/auth/methods`);
  if (!res.ok) return { methods: ["secret_key"] };
  return res.json();
}

export async function authGitHub(redirectUri: string) {
  const res = await fetch(`${API_BASE}/auth/github?redirect_uri=${encodeURIComponent(redirectUri)}`);
  if (!res.ok) throw new Error("GitHub auth not available");
  return res.json();
}

export async function authGitHubCallback(code: string, state: string) {
  const res = await fetch(`${API_BASE}/auth/github/callback?code=${code}&state=${state}`, {
    method: "POST",
  });
  if (res.status === 403) throw new Error("unauthorized");
  if (!res.ok) throw new Error("GitHub callback failed");
  return res.json();
}

export async function authTotpSetup(adminKey: string) {
  const res = await fetch(`${API_BASE}/auth/totp/setup`, {
    method: "POST",
    headers: { "X-Admin-Key": adminKey },
  });
  if (!res.ok) throw new Error("TOTP setup failed");
  return res.json();
}

export async function authTotpVerify(code: string) {
  const res = await fetch(`${API_BASE}/auth/totp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (res.status === 403) throw new Error("invalid_code");
  if (!res.ok) throw new Error("TOTP verify failed");
  return res.json();
}

export async function authValidate(token: string) {
  const res = await fetch(`${API_BASE}/auth/validate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { valid: false };
  return res.json();
}

// --- Analytics API ---

export async function fetchEvolution() {
  const res = await fetch(`${API_BASE}/analytics/evolution`);
  if (!res.ok) throw new Error("Evolution fetch failed");
  return res.json();
}

export async function fetchVisitorAnalytics() {
  const res = await fetch(`${API_BASE}/analytics/visitors`);
  if (!res.ok) throw new Error("Visitor analytics failed");
  return res.json();
}

export async function fetchMoodAnalytics() {
  const res = await fetch(`${API_BASE}/analytics/moods`);
  if (!res.ok) throw new Error("Mood analytics failed");
  return res.json();
}

export async function fetchCodeStats() {
  const res = await fetch(`${API_BASE}/analytics/code-stats`);
  if (!res.ok) throw new Error("Code stats failed");
  return res.json();
}

export async function fetchThoughtTopics() {
  const res = await fetch(`${API_BASE}/analytics/thoughts/topics`);
  if (!res.ok) throw new Error("Topics fetch failed");
  return res.json();
}

export async function fetchMemoryGarden() {
  const res = await fetch(`${API_BASE}/analytics/memory`);
  if (!res.ok) throw new Error("Memory fetch failed");
  return res.json();
}

export async function fetchSeasonalMoods() {
  const res = await fetch(`${API_BASE}/analytics/moods`);
  if (!res.ok) throw new Error("Seasonal moods fetch failed");
  return res.json();
}

export async function fetchStatus(): Promise<{
  mood: string;
  last_wake_time: string | null;
  visitor_count: number;
  micro_thought: string | null;
}> {
  const res = await fetch(`${API_BASE}/analytics/status`);
  if (!res.ok) throw new Error("Status fetch failed");
  return res.json();
}

// --- Pages API ---

export async function fetchCustomPages() {
  const res = await fetch(`${API_BASE}/pages`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCustomPage(slug: string) {
  const res = await fetch(`${API_BASE}/pages/${slug}`);
  if (!res.ok) throw new Error("Page not found");
  return res.json();
}
