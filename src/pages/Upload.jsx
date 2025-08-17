// src/pages/Upload.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { extractRoomId, isValidId } from "../lib/extractRoomId";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  "https://aireceiptsplit-backend-production.up.railway.app";

export default function Upload() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleFile(file) {
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file); // backend expects "file"

      const res = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        body: form,
      });

      const headers = Object.fromEntries(res.headers.entries());
      const rawText = await res.clone().text().catch(() => "");
      const data = await res.json().catch(() => ({}));

      console.log("[parse] backend response", { headers, data });

      const id = extractRoomId({ data, headers, rawText });

      if (!isValidId(id)) {
        console.warn("Parse succeeded but no valid room id in response:", {
          data,
          headers,
          rawText,
          id,
        });
        alert(
          'Parsed successfully, but no valid room id returned.\n' +
          'Make sure backend returns e.g. { id: "abc123" } or sets a Location: /room/abc123 header.'
        );
        return;
      }

      navigate(`/room/${encodeURIComponent(id)}`);
    } catch (err) {
      console.error(err);
      alert(
        `Upload failed: ${err.message}\n\n` +
        `Tips:\n` +
        `• Ensure CORS is enabled on the backend\n` +
        `• Endpoint should be POST ${API_BASE}/parse\n` +
        `• Field name should be "file"`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ padding: 24 }}>
      <h2>Upload a receipt</h2>
      <input
        type="file"
        accept="image/*,.pdf"
        disabled={loading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = ""; // allow re-select same file
        }}
      />
      {loading && <div style={{ marginTop: 8 }}>Uploading & parsing…</div>}
    </div>
  );
}
