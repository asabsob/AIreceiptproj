// src/lib/api.js
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:5000"
    : "https://aireceiptsplit-backend-production.up.railway.app");

/**
 * Upload a single file to /parse and return { data, rawText, headers }.
 * Uses fetch; do NOT set Content-Type when sending FormData.
 */
export async function uploadReceipt(file) {
  const fd = new FormData();
  // If your backend expects "image" instead of "file", change the key here.
  fd.append("file", file);

  const res = await fetch(`${BACKEND_URL}/parse`, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${text}`.trim());
  }

  const contentType = res.headers.get("content-type") || "";
  let data = {};
  let rawText = "";

  try {
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      // Try text, then best-effort JSON parse
      rawText = await res.text();
      try { data = JSON.parse(rawText); } catch { /* not JSON */ }
    }
  } catch {
    // Ignore parse error, keep defaults
  }

  const payload = { data, rawText, headers: res.headers };
  // Make it easy to inspect in DevTools if needed
  // (Type window.__lastParseResponse in the console to see it)
  window.__lastParseResponse = payload;
  return payload;
}
