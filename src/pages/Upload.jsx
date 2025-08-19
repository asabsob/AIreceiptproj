// src/pages/Upload.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { extractRoomId, isValidId } from "../lib/extractRoomId";

const API_BASE =
  (import.meta.env.VITE_BACKEND_URL?.replace(/\/+$/, "") ||
    (import.meta.env.DEV
      ? "http://localhost:5000"
      : "https://aireceiptsplit-backend-production.up.railway.app"));

export default function Upload() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file); // field MUST be "file"

      // 1) Try backend "create-on-parse" first (if your server supports it)
      const res = await fetch(`${API_BASE}/parse?create=1`, {
        method: "POST",
        body: form,
      });

      const headers = Object.fromEntries(res.headers.entries());
      const rawText = await res.clone().text().catch(() => "");
      const data = await res.json().catch(() => ({}));

      console.log("[parse] backend response", { headers, data });

      // If backend already returned an id (or Location header), use it
      const idFromParse = extractRoomId({ data, headers, rawText });
      if (isValidId(idFromParse)) {
        navigate(`/room/${encodeURIComponent(idFromParse)}`);
        return;
      }

      // 2) Fallback: create the session ourselves using the parsed JSON
      const parsed = data?.data ?? data; // handle {data:{...}} or flat object
      if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
        const make = await fetch(`${API_BASE}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: parsed }),
        });

        const madeHeaders = Object.fromEntries(make.headers.entries());
        const made = await make.json().catch(() => ({}));
        console.log("[session:create] response", made);

        const id = extractRoomId({ data: made, headers: madeHeaders }) || made.id;
        if (isValidId(id)) {
          navigate(`/room/${encodeURIComponent(id)}`);
          return;
        }
      }

      alert(
        "Parsed successfully, but no room id returned.\n" +
          "I also tried creating a session with the parsed data, but no id came back.\n" +
          "Please ensure the backend returns { id: \"ABC123\" } from /parse?create=1 or from POST /session."
      );
    } catch (err) {
      console.error(err);
      alert(
        `Upload failed: ${err?.message || err}\n\nTips:\n` +
          `• Ensure CORS is enabled on the backend\n` +
          `• Endpoint should be POST ${API_BASE}/parse\n` +
          `• Field name must be "file"`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2>Upload a receipt</h2>
      <input
        type="file"
        accept="image/*,.pdf"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {busy && <div style={{ marginTop: 8, color: "#666" }}>Uploading…</div>}
    </div>
  );
}
