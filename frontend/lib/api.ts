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
  return {
    "Content-Type": "application/json",
    "X-Admin-Key": key,
  };
}

export async function adminWake(key: string) {
  const res = await fetch(`${API_BASE}/admin/wake`, {
    method: "POST",
    headers: adminHeaders(key),
  });
  if (res.status === 403) throw new Error("unauthorized");
  if (!res.ok) throw new Error("Wake failed");
  return res.json();
}

export async function adminStatus(key: string) {
  const res = await fetch(`${API_BASE}/admin/status`, {
    headers: adminHeaders(key),
  });
  if (res.status === 403) throw new Error("unauthorized");
  if (!res.ok) throw new Error("Status fetch failed");
  return res.json();
}

export async function adminPostNews(key: string, content: string) {
  const res = await fetch(`${API_BASE}/admin/news`, {
    method: "POST",
    headers: adminHeaders(key),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("News post failed");
  return res.json();
}

export async function adminListNews(key: string) {
  const res = await fetch(`${API_BASE}/admin/news`, {
    headers: adminHeaders(key),
  });
  if (!res.ok) throw new Error("News fetch failed");
  return res.json();
}

export async function adminListVisitors(key: string, limit = 100) {
  const res = await fetch(`${API_BASE}/admin/visitors?limit=${limit}`, {
    headers: adminHeaders(key),
  });
  if (!res.ok) throw new Error("Visitors fetch failed");
  return res.json();
}

export async function adminModerateVisitor(key: string, id: string, action: string) {
  const res = await fetch(`${API_BASE}/admin/visitors/${id}`, {
    method: "PATCH",
    headers: adminHeaders(key),
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error("Moderate failed");
  return res.json();
}

export async function adminBanVisitor(key: string, fingerprint: string) {
  const res = await fetch(`${API_BASE}/admin/visitors/ban`, {
    method: "POST",
    headers: adminHeaders(key),
    body: JSON.stringify({ fingerprint }),
  });
  if (!res.ok) throw new Error("Ban failed");
  return res.json();
}

export async function adminCreateBackup(key: string) {
  const res = await fetch(`${API_BASE}/admin/backup`, {
    method: "POST",
    headers: adminHeaders(key),
  });
  if (!res.ok) throw new Error("Backup failed");
  return res.json();
}

export async function adminListBackups(key: string) {
  const res = await fetch(`${API_BASE}/admin/backups`, {
    headers: adminHeaders(key),
  });
  if (!res.ok) throw new Error("Backups fetch failed");
  return res.json();
}

export async function adminActivity(key: string, limit = 50) {
  const res = await fetch(`${API_BASE}/admin/activity?limit=${limit}`, {
    headers: adminHeaders(key),
  });
  if (!res.ok) throw new Error("Activity fetch failed");
  return res.json();
}

export async function adminRateLimits(key: string) {
  const res = await fetch(`${API_BASE}/admin/rate-limits`, {
    headers: adminHeaders(key),
  });
  if (!res.ok) throw new Error("Rate limits fetch failed");
  return res.json();
}
