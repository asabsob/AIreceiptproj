// src/pages/Upload.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { extractRoomId, isValidId } from "../lib/extractRoomId";

// One backend base, declared once
const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  "https://aireceiptsplit-backend-production.up.railway.app";

export function Upload() {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleFile(file) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file); // backend expects "file"

      const res = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        body: form,
      });

      // Build the “response-like” object for our extractor
      const headers = Object.fromEntries(res.headers.entries());
      const rawText = await res.clone().text().catch(() => "");
      const data = await res.json().catch(() => ({}));

      console.log("[parse] backend response", { headers, data });

      const id = extractRoomId({ data, headers, rawText });

      if (!isValidId(id)) {
        alert(
          "Parsed successfully, but no valid room id returned. Please check the backend response shape."
        );
        return;
      }

      // Verify the session exists before navigating
      const check = await fetch(
        `${API_BASE}/session/${encodeURIComponent(id)}`
      );
      if (!check.ok) {
        console.warn("ID verification failed:", id, check.status);
        alert(
          `Backend returned id "${id}", but GET /session/${id} responded ${check.status}. ` +
            `Adjust the backend to return the real session id.`
        );
        return;
      }

      navigate(`/room/${encodeURIComponent(id)}`);
    } catch (e) {
      console.error(e);
      alert(`Upload failed: ${e.message}

Tips:
• Ensure CORS is enabled on the backend
• Endpoint should be POST ${API_BASE}/parse
• Field name should be "file" (fallback tries "image")`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2>Upload a receipt</h2>
      <input
        type="file"
        accept="image/*,application/pdf"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = ""; // reset input
        }}
      />
    </div>
  );
}
