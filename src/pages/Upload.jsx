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
      // ---- 1) PARSE (no heuristics, no id guessing) ----
      const form = new FormData();
      form.append("file", file);

      const parseUrl = `${API_BASE}/parse?create=1&cb=${Date.now()}`;
      const parseRes = await fetch(parseUrl, { method: "POST", body: form });

      const parseText = await parseRes.clone().text().catch(() => "");
      let parseJson = {};
      try { parseJson = await parseRes.json(); } catch {}

      console.log("[/parse] status:", parseRes.status, parseJson || parseText);

      if (!parseRes.ok) {
        throw new Error(
          parseJson?.error || `Parse failed (HTTP ${parseRes.status})`
        );
      }

      // If backend already created a session, use it.
      if (parseJson?.id) {
        navigate(`/room/${encodeURIComponent(String(parseJson.id))}`);
        return;
      }

      // ---- 2) FALLBACK: CREATE SESSION from parsed items ----
      const items = parseJson?.items;
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Parser returned no items to create a session.");
      }

      const body = JSON.stringify({
        data: {
          items,
          subtotal: parseJson?.subtotal ?? null,
          tax: parseJson?.tax ?? null,
          total: parseJson?.total ?? null,
        },
      });

      const sessUrl = `${API_BASE}/session?cb=${Date.now()}`;
      const sessRes = await fetch(sessUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const sessText = await sessRes.clone().text().catch(() => "");
      let sessJson = {};
      try { sessJson = await sessRes.json(); } catch {}

      console.log("[/session] status:", sessRes.status, sessJson || sessText);

      if (!sessRes.ok || !sessJson?.id) {
        throw new Error(
          sessJson?.error ||
          `Could not create session (HTTP ${sessRes.status})`
        );
      }

      navigate(`/room/${encodeURIComponent(String(sessJson.id))}`);
    } catch (e) {
      console.error("[upload] error:", e);
      alert(
        `Upload failed: ${e.message}\n\n` +
        `Backend: ${API_BASE}\n` +
        `Check DevTools → Network for /parse and /session responses.`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2>Upload a receipt</h2>
      <p>We’ll parse it and open a live room automatically.</p>

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
