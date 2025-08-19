// src/pages/Upload.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { extractRoomId, isValidId } from "../lib/extractRoomId";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? "http://localhost:5000"
    : "https://aireceiptsplit-backend-production.up.railway.app");

export default function Upload() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);

      // Ask backend to PARSE and CREATE a session in one go
      const res = await fetch(`${API_BASE}/parse?create=1`, {
        method: "POST",
        body: form,
      });

      const headers = Object.fromEntries(res.headers.entries());
      const rawText = await res.clone().text().catch(() => "");
      const payload = await res.json().catch(() => ({}));

      console.log("[parse] backend response", { headers, data: payload });

      // Prefer explicit id from the response
      let id = payload?.id || extractRoomId({ data: payload, headers, rawText });

      // If the backend returned only parsed items (no id), create a session now
      if (!isValidId(id) && payload && Array.isArray(payload.items)) {
        const make = await fetch(`${API_BASE}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: payload }),
        });
        if (!make.ok) {
          const txt = await make.text().catch(() => "");
          throw new Error(`Failed to create session: HTTP ${make.status} ${txt}`);
        }
        const made = await make.json();
        id = made?.id;
      }

      // Final guard: only proceed on a *real* id
      if (!isValidId(id)) {
        alert(
          "Parsed successfully, but no valid room id was returned.\n" +
            "Ensure the backend either:\n" +
            "• responds to /parse?create=1 with { id, joinUrl }, or\n" +
            "• allows POST /session { data } to create a session."
        );
        return;
      }

      // (Optional) double-check that the session actually exists server-side
      const check = await fetch(`${API_BASE}/session/${encodeURIComponent(id)}`);
      if (!check.ok) {
        alert(`Session ${id} was not found on the server (HTTP ${check.status}).`);
        return;
      }

      navigate(`/room/${encodeURIComponent(id)}`);
    } catch (e) {
      console.error(e);
      alert(
        `Upload failed: ${e.message}\n\nTips:\n` +
          "• Ensure CORS is enabled on the backend\n" +
          `• Endpoint should be POST ${API_BASE}/parse?create=1\n` +
          '• Field name should be "file" (fallback tries "image")'
      );
    } finally {
      setBusy(false);
    }
  }

  function onChange(e) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = ""; // allow re-upload same file
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2>Upload a receipt</h2>
      <input type="file" accept="image/*" onChange={onChange} disabled={busy} />
      {busy && <div style={{ marginTop: 8 }}>Uploading…</div>}
    </div>
  );
}
