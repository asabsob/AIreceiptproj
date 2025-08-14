import React, { useState, useMemo } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import { Link } from "react-router-dom";
import Header from "../components/Header.jsx";

const isDev = import.meta.env.DEV;
const BACKEND = isDev
  ? (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000")
  : (import.meta.env.VITE_BACKEND_URL || "");

const PUBLIC_ORIGIN = import.meta.env.VITE_PUBLIC_ORIGIN || window.location.origin;

function toBase64Unicode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export default function Upload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [room, setRoom] = useState(null);
  const [creating, setCreating] = useState(false);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setErr("");
  };

  const parse = async () => {
    if (!file) return setErr("Choose an image first.");
    setLoading(true);
    setErr("");
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await axios.post(`${BACKEND}/parse`, form, { timeout: 60000 });
      setResult(data);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Parse failed");
    } finally {
      setLoading(false);
    }
  };

  const startRoom = async () => {
    if (!result) return;
    setCreating(true);
    try {
      const { data } = await axios.post(`${BACKEND}/session`, { data: result }, { timeout: 20000 });
      setRoom(data); // { id, joinUrl }
    } catch (e) {
      alert("Could not create room.");
    } finally {
      setCreating(false);
    }
  };

  // also allow “offline share” via /room without server by embedding data? (we’ll keep it simple—use rooms)
  const joinUrl = room?.joinUrl || "";

  const totals = useMemo(() => {
    if (!result?.items) return { subtotal: 0, tax: null, total: 0 };
    const subtotal =
      result.subtotal ??
      result.items.reduce((a, it) => a + (Number(it.price)||0) * (Number(it.quantity)||1), 0);
    const tax = result.tax ?? null;
    const total = result.total ?? (subtotal + (tax||0));
    return { subtotal, tax, total };
  }, [result]);

  return (
    <div style={{ background: "#fafafa", minHeight: "100vh" }}>
      <Header />
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>Upload & Parse</h2>
          <Link to="/" style={{ fontSize: 14, opacity: 0.7 }}>Home</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start", marginTop: 12 }}>
          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Receipt image
            </label>
            <input type="file" accept="image/*" onChange={onFile} />
            {preview && (
              <div style={{ marginTop: 12 }}>
                <img src={preview} alt="preview" style={{ maxWidth: "100%", borderRadius: 12, border: "1px solid #eee" }}/>
              </div>
            )}
            <button
              onClick={parse}
              disabled={loading || !file}
              style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Parsing…" : "Parse receipt"}
            </button>
            {err && <div style={{ marginTop: 10, color: "#b00020", fontWeight: 600 }}>{err}</div>}
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, minHeight: 180 }}>
            <h3 style={{ marginTop: 0 }}>Parsed Result</h3>
            {!result && <div style={{ color: "#777" }}>No data yet.</div>}
            {result && (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Item</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Qty</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Price</th>
                      <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items?.map((it, i) => (
                      <tr key={i}>
                        <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>{it.name}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>{it.quantity}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>{Number(it.price||0).toFixed(3)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                          {((Number(it.price)||0) * (Number(it.quantity)||1)).toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 420, gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Subtotal</span><b>{Number(totals.subtotal||0).toFixed(3)}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Tax</span><b>{totals.tax != null ? Number(totals.tax).toFixed(3) : "-"}</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Total</span><b>{Number(totals.total||0).toFixed(3)}</b>
                  </div>
                </div>

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #eee" }}>
                  {!room && (
                    <button
                      onClick={startRoom}
                      disabled={creating}
                      style={{ padding: "8px 12px", border: "1px solid #111", borderRadius: 8, background: "#111", color: "#fff", cursor: creating ? "not-allowed" : "pointer" }}
                    >
                      {creating ? "Creating room…" : "Start live split"}
                    </button>
                  )}
                  {room && (
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, color: "#2e7d32" }}>Room <b>{room.id}</b> ✓</span>
                      <a href={room.joinUrl} target="_blank" rel="noreferrer"
                         style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>
                        Open room
                      </a>
                      <QRCodeCanvas value={room.joinUrl} size={160} includeMargin />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: "#777" }}>
          Backend: <code>{BACKEND || "(set VITE_BACKEND_URL)"}</code>
        </div>
      </div>
    </div>
  );
}
