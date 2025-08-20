// src/pages/Upload.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  "https://aireceiptsplit-backend-production.up.railway.app";

export default function Upload() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    setBusy(true);
    try {
      // 1) Parse image -> get items
      const form = new FormData();
      form.append("file", file);

      const parseUrl = `${API_BASE}/parse`; // <-- no flags, just parse
      console.log("[upload] POST", parseUrl);
      const parseRes = await fetch(parseUrl, { method: "POST", body: form });

      const headers = Object.fromEntries(parseRes.headers.entries());
      const rawText = await parseRes.clone().text().catch(() => "");
      let parsed = {};
      try { parsed = await parseRes.json(); } catch {}
      console.log("[parse] backend response", { headers, data: parsed });

      if (!parseRes.ok) {
        throw new Error(
          parsed?.error || `HTTP ${parseRes.status}. Raw: ${rawText?.slice(0, 400)}`
        );
      }

      // 2) Validate items
      if (!Array.isArray(parsed?.items) || parsed.items.length === 0) {
        throw new Error("Parse returned no items.");
      }

      // 3) Always create a session on the backend from parsed data
      const sessionUrl = `${API_BASE}/session`;
      console.log("[session] POST", sessionUrl, "items:", parsed.items.length);
      const sRes = await fetch(sessionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsed }),
      });

      const sText = await sRes.clone().text().catch(() => "");
      let sJson = {};
      try { sJson = await sRes.json(); } catch {}
      console.log("[session] response", sRes.status, sJson || sText);

      if (!sRes.ok) {
        throw new Error(
          sJson?.error || `Could not create session (HTTP ${sRes.status}). Raw: ${sText?.slice(0, 400)}`
        );
      }

      const id = sJson?.id;
      if (!id) {
        throw new Error("Session created but no id returned.");
      }

      console.log("[upload] navigate -> /room/", id);
      navigate(`/room/${encodeURIComponent(String(id))}`);
    } catch (e) {
      console.error("[upload] error", e);
      alert(
        `Upload failed: ${e.message}\n\n` +
        `Backend: ${API_BASE}\n` +
        "Open DevTools → Network and check the /parse then /session requests."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2>Upload a receipt</h2>
      <p style={{ color: "#555" }}>
        Choose an image; we’ll parse it and create a live room to split the bill.
      </p>

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

      <div style={{ marginTop: 16 }}>
        <Link to="/">← Back</Link>
      </div>

      {busy && <div style={{ marginTop: 12 }}>Uploading & parsing…</div>}
    </div>
  );
}
