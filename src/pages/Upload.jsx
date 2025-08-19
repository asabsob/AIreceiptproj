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
      form.append("file", file); // field name must be "file"

      // ---- 1) Try parse?create=1 (if backend supports returning an id) ----
      const res = await fetch(`${API_BASE}/parse?create=1`, { method: "POST", body: form });

      // capture everything for debugging
      const status = res.status;
      const ok = res.ok;
      const headers = Object.fromEntries(res.headers.entries());
      const rawText = await res.clone().text().catch(() => "");
      let data = {};
      try { data = await res.json(); } catch { /* not JSON */ }

      // Print the *actual* payload, not just [Object]
      console.log("[parse] status:", status, "ok:", ok);
      console.log("[parse] headers:", headers);
      console.log("[parse] rawText:", rawText.slice(0, 1000)); // first 1k chars
      console.log("[parse] json:", data);

      if (!ok) {
        const msg = data?.error || data?.message || `HTTP ${status}`;
        throw new Error(`Parse failed: ${msg}`);
      }

      // If backend returned an id (or Location header), use it
      const idFromParse = extractRoomId({ data, headers, rawText });
      if (isValidId(idFromParse)) {
        navigate(`/room/${encodeURIComponent(idFromParse)}`);
        return;
      }

      // ---- 2) Fallback: create a session from the parsed items ----
      // Accept both {data:{items:[]}} and {items:[]}
      const parsed = data?.data ?? data;
      if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
        const make = await fetch(`${API_BASE}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: parsed }),
        });

        const makeStatus = make.status;
        const makeHeaders = Object.fromEntries(make.headers.entries());
        const makeRaw = await make.clone().text().catch(() => "");
        let made = {};
        try { made = await make.json(); } catch {}
        console.log("[session:create] status:", makeStatus, "json:", made, "raw:", makeRaw);

        if (!make.ok) {
          const m = made?.error || `HTTP ${makeStatus}`;
          throw new Error(`Session create failed: ${m}`);
        }

        const id = extractRoomId({ data: made, headers: makeHeaders, rawText: makeRaw }) || made.id;
        if (isValidId(id)) {
          navigate(`/room/${encodeURIComponent(id)}`);
          return;
        }

        throw new Error("Session create returned no valid id.");
      }

      // If we’re here, parse returned no items — nothing to create a session from.
      alert(
        "Parse returned no items, so I couldn’t create a session.\n\n" +
        "Open your browser DevTools → Network → the /parse request and check the Response.\n" +
        "Common causes:\n" +
        "• Backend didn’t parse the image (missing OPENAI_API_KEY or model error)\n" +
        "• Backend returned an error JSON (check the console logs I printed)\n"
      );
    } catch (err) {
      console.error(err);
      alert(
        `Upload failed: ${err?.message || err}\n\n` +
        `Tips:\n` +
        `• CORS enabled on backend\n` +
        `• Endpoint: POST ${API_BASE}/parse (field name "file")\n` +
        `• If /parse doesn’t return an id, the code falls back to POST ${API_BASE}/session`
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
