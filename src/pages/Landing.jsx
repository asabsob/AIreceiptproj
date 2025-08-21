// src/pages/Landing.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  "https://aireceiptsplit-backend-production.up.railway.app";

export function Landing() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);

      // 1) Ask backend to PARSE and also CREATE if supported
      const parseUrl = `${API_BASE}/parse?create=1`;
      const pRes = await fetch(parseUrl, { method: "POST", body: form });

      const pHeaders = Object.fromEntries(pRes.headers.entries());
      const pRaw = await pRes.clone().text().catch(() => "");
      let pJson = {};
      try { pJson = await pRes.json(); } catch {}

      console.log("[landing/parse] status:", pRes.status, { headers: pHeaders, data: pJson });

      if (!pRes.ok) {
        throw new Error(
          pJson?.error || `Parse failed (HTTP ${pRes.status}). Raw: ${pRaw?.slice(0, 400)}`
        );
      }

      // If backend already created a session, use that id
      const idFromParse = pJson?.id || pJson?.roomId || pJson?.sessionId || pJson?.receiptId;
      if (idFromParse) {
        navigate(`/room/${encodeURIComponent(String(idFromParse))}`);
        return;
      }

      // 2) Fallback: create a session ourselves if items exist
      if (Array.isArray(pJson?.items) && pJson.items.length > 0) {
        const sRes = await fetch(`${API_BASE}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: pJson }),
        });

        const sRaw = await sRes.clone().text().catch(() => "");
        let sJson = {};
        try { sJson = await sRes.json(); } catch {}

        console.log("[landing/session] status:", sRes.status, sJson || sRaw);

        if (!sRes.ok) {
          throw new Error(
            sJson?.error || `Could not create session (HTTP ${sRes.status}). Raw: ${sRaw?.slice(0, 400)}`
          );
        }

        const sid = sJson?.id;
        if (sid) {
          navigate(`/room/${encodeURIComponent(String(sid))}`);
          return;
        }
      }

      alert(
        "Parsed successfully, but no room id returned.\n\n" +
        "Either:\n" +
        "• Update backend to return { id } from POST /parse?create=1, or\n" +
        "• Ensure the fallback POST /session succeeds (check Network tab)."
      );
    } catch (e) {
      console.error("[landing/upload] error", e);
      alert(
        `Upload failed: ${e.message}\n\n` +
        `Backend: ${API_BASE}\n` +
        "Open DevTools → Network and inspect /parse and /session."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>Split Receipts <span style={{ color: "#2563eb" }}>Smarter</span> with AI</h1>
      <p style={{ color: "#555" }}>
        Upload any receipt. We’ll parse items, assign to people, and generate payment links—fast.
      </p>

      <label
        style={{
          display: "inline-block",
          padding: "10px 16px",
          background: "#2563eb",
          color: "#fff",
          borderRadius: 10,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        <input
          type="file"
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        {busy ? "Uploading…" : "Upload Receipt"}
      </label>

      <ul style={{ marginTop: 16, color: "#555" }}>
        <li>Works with photos or PDFs</li>
        <li>No POS integration required</li>
        <li>Shareable QR payment links</li>
      </ul>
    </div>
  );
}
