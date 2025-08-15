import React, { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

// Backend URL
const isDev = import.meta.env.DEV;
const API_BASE = isDev
  ? import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
  : import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [room, setRoom] = useState(null);
  const [creating, setCreating] = useState(false);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    setResult(null);
    setError("");
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleParse = async () => {
    if (!file) {
      setError("Choose an image first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await axios.post(`${API_BASE}/parse`, form, { timeout: 60000 });
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to parse. Check backend URL and CORS."
      );
    } finally {
      setLoading(false);
    }
  };

  const startRoom = async () => {
    if (!result || creating) return;
    setCreating(true);
    try {
      const { data } = await axios.post(`${API_BASE}/session`, { data: result }, { timeout: 20000 });
      setRoom(data); // { id, joinUrl }
    } catch (e) {
      console.error(e);
      alert("Couldn't start a room. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const totalCalc =
    result?.items?.reduce(
      (a, it) => a + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    ) ?? 0;

  const service =
    result
      ? Math.max(
          0,
          Number(result.total ?? 0) -
            Number(result.subtotal ?? 0) -
            Number(result.tax ?? 0)
        )
      : 0;

  return (
    <div style={{ maxWidth: 1100, margin: "32px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>AIReceiptPro</h1>
        <span style={{ fontSize: 13, color: "#777" }}>
          Backend: <code>{API_BASE}</code>
        </span>
      </div>

      <p style={{ color: "#666", marginTop: 8 }}>
        Upload a receipt → parse with AI → (optional) start a live room to share.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* left */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <label htmlFor="file" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Receipt image
          </label>
          <input id="file" type="file" accept="image/*" onChange={onFile} />
          {preview && (
            <div style={{ marginTop: 12 }}>
              <img
                src={preview}
                alt="preview"
                style={{ maxWidth: "100%", borderRadius: 12, border: "1px solid #eee" }}
              />
            </div>
          )}
          <button
            onClick={handleParse}
            disabled={loading || !file}
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Parsing…" : "Parse receipt"}
          </button>
          {error && <div style={{ marginTop: 12, color: "#b00020", fontWeight: 600 }}>{error}</div>}
        </div>

        {/* right */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, minHeight: 200 }}>
          <h3 style={{ marginTop: 0 }}>Parsed result</h3>
          {!result && <div style={{ color: "#777" }}>No data yet.</div>}

          {result && (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Item</th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Qty</th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Price</th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>{it.name}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                        {Number(it.quantity || 1).toFixed(3)}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                        {Number(it.price || 0).toFixed(3)}
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                        {((Number(it.price) || 0) * (Number(it.quantity) || 1)).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td />
                    <td />
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>Subtotal</td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>
                      {Number(result.subtotal ?? totalCalc).toFixed(3)}
                    </td>
                  </tr>
                  <tr>
                    <td />
                    <td />
                    <td style={{ padding: 8, textAlign: "right" }}>Service</td>
                    <td style={{ padding: 8, textAlign: "right" }}>{service.toFixed(3)}</td>
                  </tr>
                  <tr>
                    <td />
                    <td />
                    <td style={{ padding: 8, textAlign: "right" }}>Tax</td>
                    <td style={{ padding: 8, textAlign: "right" }}>
                      {result.tax != null ? Number(result.tax).toFixed(3) : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td />
                    <td />
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>Total</td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>
                      {Number(result.total ?? totalCalc).toFixed(3)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {!room && (
                  <button
                    onClick={startRoom}
                    disabled={creating}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #111",
                      background: "#111",
                      color: "#fff",
                      cursor: creating ? "not-allowed" : "pointer",
                    }}
                  >
                    {creating ? "Starting…" : "Start live room"}
                  </button>
                )}
                {room && (
                  <>
                    <span style={{ fontSize: 13, color: "#2e7d32" }}>
                      Room <b>{room.id}</b> created ✓
                    </span>
                    <a
                      href={room.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}
                    >
                      Open room
                    </a>
                  </>
                )}
              </div>

              <details style={{ marginTop: 12 }}>
                <summary>Raw JSON</summary>
                <pre style={{ whiteSpace: "pre-wrap", background: "#fafafa", padding: 12, borderRadius: 8 }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 13 }}>
        Tip: set <code>VITE_BACKEND_URL</code> in Vercel to your Railway URL.
        &nbsp; <Link to="/room/TEST">Sample room link</Link>
      </div>
    </div>
  );
}
