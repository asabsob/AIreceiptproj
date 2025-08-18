// src/pages/Upload.jsx
import React, { useCallback, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { extractRoomId, isValidId } from "../lib/extractRoomId";

const isDev = import.meta.env.DEV;
const API_BASE = isDev
  ? (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000")
  : (import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app");

export default function Upload() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const onChooseFile = () => inputRef.current?.click();

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_BASE}/parse`, {
        method: "POST",
        body: form,
      });

      // Build a response-like object for heuristics
      const headers = Object.fromEntries(res.headers.entries());
      const rawText = await res.clone().text().catch(() => "");
      const data = await res.json().catch(() => ({}));

      // Helpful console logs (mirrors the ones you were seeing)
      console.log("[parse] backend response");
      console.log("headers:", headers);
      console.log("data:", data);

      // Try to pull an id from parse result
      const id = extractRoomId({ data, headers, rawText });

      if (isValidId(id)) {
        navigate(`/room/${encodeURIComponent(id)}`);
        return;
      }

      // Fallback: if we got items but no id, create a live session
      if (data && Array.isArray(data.items)) {
        const r = await fetch(`${API_BASE}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        const j = await r.json().catch(() => ({}));
        if (isValidId(j?.id)) {
          navigate(`/room/${encodeURIComponent(j.id)}`);
          return;
        }
      }

      console.warn("Parse succeeded but no valid room id in response:", {
        data,
        headers,
        rawText,
        id,
      });
      alert(
        "Parsed successfully, but no valid room id returned.\n" +
        "Ensure the backend returns { id: \"ABC123\" } or sets a Location: /room/ABC123 header.\n" +
        "If you can't change /parse, it should at least return { items: [...] } so we can create a session."
      );
    } catch (err) {
      console.error(err);
      alert(
        `Upload failed: ${err?.message || err}\n\nTips:\n` +
        `• Ensure CORS is enabled on the backend\n` +
        `• Endpoint should be POST ${API_BASE}/parse\n` +
        `• Field name should be "file" (fallback tries "image")`
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [navigate]);

  const onInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 700, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Upload a receipt</h2>
        <Link to="/" style={{ fontSize: 14 }}>← Back</Link>
      </header>

      <p style={{ color: "#555", marginTop: 0 }}>
        Drop an image of the receipt, or choose a file. We’ll parse it and start a live room you can share.
      </p>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        style={{
          border: "2px dashed #ddd",
          borderRadius: 12,
          padding: 28,
          textAlign: "center",
          background: "#fafafa",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={onInputChange}
        />
        <div style={{ marginBottom: 12, fontSize: 14, color: "#666" }}>
          Drag & drop your receipt image here
        </div>
        <button
          onClick={onChooseFile}
          disabled={uploading}
          style={{
            padding: "10px 14px",
            border: "1px solid #ddd",
            borderRadius: 8,
            cursor: uploading ? "not-allowed" : "pointer",
            background: uploading ? "#eee" : "#111",
            color: uploading ? "#999" : "#fff",
            fontWeight: 600,
          }}
        >
          {uploading ? "Uploading…" : "Choose a file"}
        </button>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: "#777" }}>
        Backend: <code>{API_BASE}</code>
      </div>
    </div>
  );
}
