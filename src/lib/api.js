// Centralize the backend URL and parsing call
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:5000"
    : "https://aireceiptsplit-backend-production.up.railway.app");

// Preferred multipart field name. Most of your backends used "file".
const FILE_FIELD = "file";

export async function parseReceipt(file) {
  // 1st attempt: field name "file"
  let fd = new FormData();
  fd.append(FILE_FIELD, file);

  let res = await fetch(`${BACKEND_URL}/parse`, {
    method: "POST",
    body: fd,
    // DO NOT set Content-Type; the browser will set boundary for FormData
    headers: { Accept: "application/json" },
  });

  // If API expects a different field name, try a fallback once
  if (!res.ok && (res.status === 400 || res.status === 415)) {
    const alt = new FormData();
    alt.append("image", file);
    res = await fetch(`${BACKEND_URL}/parse`, {
      method: "POST",
      body: alt,
      headers: { Accept: "application/json" },
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Parse failed (${res.status}): ${text || "no message"}`);
  }

  return res.json();
}
