import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { extractRoomId, isValidId } from "../lib/extractRoomId";

export function Upload() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    const form = new FormData();
    form.append("file", file);

    const base =
      import.meta.env.VITE_BACKEND_URL ||
      "https://aireceiptsplit-backend-production.up.railway.app";

    try {
      const res = await fetch(`${base}/parse`, { method: "POST", body: form });

      // robust debugging
      const headers = Object.fromEntries(res.headers.entries());
      const rawText = await res.clone().text().catch(() => "");
      let data = {};
      try { data = await res.json(); } catch {}

      console.log("[parse] status:", res.status);
      console.log("[parse] headers:", headers);
      console.log("[parse] data:", data);
      console.log("[parse] rawText:", rawText);

      const id = extractRoomId({ data, headers, rawText });

      if (!isValidId(id)) {
        alert(
          "Parsed successfully, but no valid room id returned. Check backend response shape.\n" +
          "Expected { id: \"abc123\" } or a Location header like /room/abc123.",
        );
        return;
      }

      // sanity-check that the room exists
      const check = await fetch(`${base}/session/${encodeURIComponent(id)}`);
      if (!check.ok) {
        alert(
          `The backend did not recognize room "${id}" (GET /session/${id} -> ${check.status}).`,
        );
        return;
      }

      navigate(`/room/${encodeURIComponent(id)}`);
    } catch (err) {
      console.error(err);
      alert(`Upload failed: ${err.message}

Tips:
• Ensure CORS is enabled on the backend
• Endpoint should be POST ${base}/parse
• Field name should be "file" (fallback tries "image")`);
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
          if (f) {
            setBusy(true);
            handleFile(f).finally(() => {
              setBusy(false);
              e.target.value = "";
            });
          }
        }}
      />
      <div style={{ marginTop: 12 }}>
        <Link to="/">← Back</Link>
      </div>
    </div>
  );
}

export default Upload; // keep default too, so both imports work
