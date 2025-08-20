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
    const form = new FormData();
    form.append("file", file);
    // ALSO send a body flag so the backend can see it even if query params are stripped
    form.append("createSession", "1");

    // cache-bust to avoid any weird edge caches
    const url = `${API_BASE}/parse?create=1&_=${Date.now()}`;
    console.log("[upload] POST", url);

    const res = await fetch(url, { method: "POST", body: form });

    const headers = Object.fromEntries(res.headers.entries());
    const rawText = await res.clone().text().catch(() => "");
    let data = {};
    try { data = await res.json(); } catch {}
    console.log("[parse] backend response", { headers, data });

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}. Raw: ${rawText?.slice(0, 400)}`);
    }

    // Path (1): backend already created a session and returned an id
    const idFromParse = data?.id || data?.roomId || data?.sessionId || data?.receiptId;
    if (idFromParse) {
      console.log("[upload] navigate with id from /parse:", idFromParse);
      navigate(`/room/${encodeURIComponent(String(idFromParse))}`);
      return;
    }

    // Path (2): fallback – create session ourselves
    if (Array.isArray(data?.items) && data.items.length > 0) {
      const sUrl = `${API_BASE}/session`;
      console.log("[upload] POST", sUrl, "with", data.items.length, "items");
      const sRes = await fetch(sUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
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

      const sid = sJson?.id;
      if (sid) {
        console.log("[upload] navigate with id from /session:", sid);
        navigate(`/room/${encodeURIComponent(String(sid))}`);
        return;
      }
    }

    alert(
      "Parsed successfully, but no room id returned.\n\n" +
      "Either:\n" +
      "• Update backend to return { id } from POST /parse?create=1, or\n" +
      "• Ensure frontend’s fallback POST /session succeeds (check Network tab)."
    );
  } catch (e) {
    console.error("[upload] error", e);
    alert(
      `Upload failed: ${e.message}\n\n` +
      `Backend: ${API_BASE}\n` +
      "Check DevTools → Network for /parse and /session responses."
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
