// src/pages/Upload.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  "https://aireceiptsplit-backend-production.up.railway.app";

function Upload() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);

      // Ask backend to PARSE and also CREATE a session in one call
      const res = await fetch(`${API_BASE}/parse?create=1`, {
        method: "POST",
        body: form,
      });

      const headers = Object.fromEntries(res.headers.entries());
      const text = await res.clone().text().catch(() => "");
      let data = {};
      try {
        data = await res.json();
      } catch {
        // keep data as {}
      }

      console.log("[parse] backend response", { headers, data });

      if (!res.ok) {
        throw new Error(
          data?.error ||
            `HTTP ${res.status}. Check Network tab for /parse response body.`
        );
      }

      // Preferred: backend returns { id, joinUrl?, data? }
      const idFromParse =
        data?.id ||
        data?.roomId ||
        data?.sessionId ||
        data?.receiptId ||
        undefined;

      if (idFromParse) {
        navigate(`/room/${encodeURIComponent(String(idFromParse))}`);
        return;
      }

      // Fallback: if parse returned only items, create a session explicitly.
      if (Array.isArray(data?.items)) {
        const sRes = await fetch(`${API_BASE}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        const sJson = await sRes.json().catch(() => ({}));
        if (!sRes.ok) {
          throw new Error(
            sJson?.error ||
              `Could not create session (HTTP ${sRes.status}).`
          );
        }
        const sid = sJson?.id;
        if (sid) {
          navigate(`/room/${encodeURIComponent(String(sid))}`);
          return;
        }
      }

      // If we got here, we couldn't get an id
      alert(
        "Parsed successfully, but no room id returned.\n\n" +
          "Ensure the backend either:\n" +
          "• returns { id: \"ABC123\" } when calling POST /parse?create=1, or\n" +
          "• returns { items:[...] } so the frontend can POST /session."
      );
    } catch (e) {
      alert(
        `Upload failed: ${e.message}\n\nTips:\n` +
          "• Ensure CORS is enabled on the backend\n" +
          `• Endpoint: POST ${API_BASE}/parse (we call with ?create=1)\n` +
          "• Field name must be \"file\" (FormData)\n" +
          "• Check your browser DevTools → Network for the /parse response body"
      );
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2>Upload a receipt</h2>
      <p style={{ color: "#555" }}>
        Choose an image; we’ll parse it and create a live room to split the
        bill.
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

export default Upload; // <-- DEFAULT EXPORT
