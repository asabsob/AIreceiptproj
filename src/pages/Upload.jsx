// src/pages/Upload.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { extractRoomId, isValidId } from "../lib/extractRoomId";

const BASE = import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app";

export default function Upload() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);

      // 1) Ask backend to parse AND create a session (new server behavior)
      const res = await fetch(`${BASE}/parse`, { method: "POST", body: form });

      const headers = Object.fromEntries(res.headers.entries());
      const rawText = await res.clone().text().catch(() => "");
      const data = await res.json().catch(() => ({}));

      console.log("[parse] backend response", { headers, data });

      let id = (data?.id && String(data.id).toUpperCase()) || undefined;
      if (!isValidId(id)) id = extractRoomId({ data, headers, rawText });

      // Fallback (if backend not updated yet): create session manually from items
      if (!isValidId(id) && data?.items && Array.isArray(data.items)) {
        const s = await fetch(`${BASE}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        const j = await s.json().catch(() => ({}));
        if (isValidId(j?.id)) id = j.id.toUpperCase();
      }

      if (!isValidId(id)) {
        console.warn("Parse ok but no valid room id:", { headers, data, rawText, id });
        alert(
          "Parsed successfully, but no valid room id returned.\n" +
          "Please ensure the backend /parse returns { id } or Location: /room/<ID>."
        );
        return;
      }

      navigate(`/room/${id}`);
    } catch (e) {
      console.error(e);
      alert(`Upload failed: ${e.message}
      
Tips:
• Ensure CORS is enabled on the backend
• Endpoint should be POST ${BASE}/parse
• Field name should be "file" (multipart)`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h2>Upload a receipt</h2>
      <input
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {busy && <div style={{ marginTop: 8 }}>Parsing…</div>}
    </div>
  );
}
