// src/pages/Upload.jsx (relevant excerpt)
import { extractRoomId, isValidId } from "../lib/extractRoomId";

async function handleFile(file) {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app"}/parse`, {
    method: "POST",
    body: form,
  });

  // build a response-like object for heuristics
  const headers = Object.fromEntries(res.headers.entries());
  const rawText = await res.clone().text().catch(() => "");
  const data = await res.json().catch(() => ({}));

  console.log("[parse] backend response", { headers, data });

  const id = extractRoomId({ data, headers, rawText });

  if (!isValidId(id)) {
    console.warn("Parse succeeded but no valid room id in response:", { data, headers, rawText, id });
    alert("Parsed successfully, but no valid room id returned.\nMake sure backend returns e.g. { id: \"abc123\" } or sets a Location: /room/abc123 header.");
    return;
  }

  navigate(`/room/${encodeURIComponent(id)}`);
}
