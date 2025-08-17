// src/lib/api.js
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:5000"
    : "https://aireceiptsplit-backend-production.up.railway.app");

/**
 * Upload a single file to /parse and return { data, headers }.
 * Uses fetch; do NOT set Content-Type when sending FormData.
 */
export async function uploadReceipt(file) {
  const fd = new FormData();
  // If your backend expects "image" instead of "file", change the key here.
  fd.append("file", file);

  const res = await fetch(`${BACKEND_URL}/parse`, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${text}`);
  }
  const data = await res.json().catch(() => ({}));
  return { data, headers: res.headers };
}
