// src/pages/Upload.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { extractRoomId, isValidId } from "../lib/extractRoomId";

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  "https://aireceiptsplit-backend-production.up.railway.app";

export default function Upload() {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      await handleFile(file);
    } catch (err) {
      console.error(err);
      alert(`Upload failed: ${err?.message || err}

Tips:
• Ensure CORS is enabled on the backend
• Endpoint should be POST ${API_BASE}/parse
• Field name must be "file"`);
    } finally {
      setBusy(false);
      e.target.value = ""; // reset input so same file can be reselected
    }
  };

  async function handleFile(file) {
    const form = new FormData();
    form.append("file", file);

    // Ask backend to parse and (if supported) create a session in one go.
    const res = await fetch(`${API_BASE}/parse?create=1`, {
      method: "POST",
      body: form,
    });

    const headers = Object.fromEntries(res.headers.entries());
    const rawText = await res.clone().text().catch(() => "");
    const data = await res.json().catch(() => ({}));

    console.log("[parse] backend response", { headers, data });

    // 1) If backend already returned an id/joinUrl, use that.
    const found = extractRoomId({ data, headers, rawText });
    if (isValidId(found)) {
      navigate(`/room/${encodeURIComponent(found)}`);
      return;
    }

    // 2) Otherwise, create a session from parsed items.
    const items = Array.isArray(data?.items) ? data.items : null;
    if (items && items.length) {
      const createRes = await fetch(`${API_BASE}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            items,
            subtotal: data?.subtotal ?? null,
            tax: data?.tax ?? null,
            total: data?.total ?? null,
          },
        }),
      });

      if (!createRes.ok) {
        const txt = await createRes.text().catch(() => "");
        throw new Error(`Create session failed: ${createRes.status} ${txt}`);
      }

      const created = await createRes.json().catch(() => ({}));
      const id =
        extractRoomId({ data: created }) ||
        // last-gasp: try to pull from a joinUrl string
        (String(created?.joinUrl || "").match(/\/room\/([A-Za-z0-9_-]{4,})/) ||
          [])[1];

      if (isValidId(id)) {
        navigate(`/room/${encodeURIComponent(id)}`);
        return;
      }

      throw new Error("Create session returned no usable id.");
    }

    // 3) No id and no items — tell the user what to check.
    alert(
      "Parse returned no items, so I couldn’t create a session.\n\n" +
        "Open DevTools → Network → the /parse request and check the Response.\n" +
        "It must include either { id } (or Location header) OR { items:[...] }."
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Upload a receipt</h1>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={onFileChange}
        disabled={busy}
      />
      {busy && <div style={{ marginTop: 12 }}>Uploading…</div>}
    </div>
  );
}
