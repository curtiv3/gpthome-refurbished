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
