import React, { useState, useMemo } from "react";
import Header from "../components/Header.jsx";

const isDev = import.meta.env.DEV;
const BACKEND_URL = isDev
  ? (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000")
  : (import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app");

export default function Upload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [room, setRoom] = useState(null);
  const [spinningRoom, setSpinningRoom] = useState(false);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setErr("");
    setResult(null);
    setRoom(null);
  };

  const handleParse = async () => {
    if (!file) return;
    setLoading(true); setErr("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${BACKEND_URL}/parse`, { method: "POST", body: form });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setResult(json);
    } catch (e) {
      setErr(e.message || "Parse failed");
    } finally {
      setLoading(false);
    }
  };

  const startRoom = async () => {
    if (!result || spinningRoom) return;
    setSpinningRoom(true);
    try {
      const r = await fetch(`${BACKEND_URL}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: result }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json(); // { id, joinUrl }
      setRoom(json);
    } catch (e) {
      alert("Could not create live room. Try again.");
      console.error(e);
    } finally {
      setSpinningRoom(false);
    }
  };

  const computedSubtotal = useMemo(() => {
    if (!result?.items) return 0;
    return result.items.reduce((a, it) => a + (Number(it.price)||0)*(Number(it.quantity)||1), 0);
  }, [result]);

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <Header />
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ margin: 0 }}>Upload a receipt</h1>
        <p style={{ color: "#666", marginTop: 6 }}>
          Choose an image → we parse it on the server → view or share a live room.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
            <label htmlFor="file" style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Receipt image
            </label>
            <input id="file" type="file" accept="image/*" onChange={onFile} />
            {preview && (
              <div style={{ marginTop: 12 }}>
                <img src={preview} alt="preview" style={{ maxWidth: "100%", borderRadius: 12, border: "1px solid #eee" }}/>
              </div>
            )}
            <button onClick={handleParse} disabled={loading || !file}
              style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", cursor: loading||!file ? "not-allowed":"pointer" }}>
              {loading ? "Parsing…" : "Parse"}
            </button>
            {err && <div style={{ marginTop: 10, color: "#b00020", fontWeight: 600 }}>{err}</div>}
          </div>

          <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Parsed result</h3>
            {!result && <div style={{ color: "#777" }}>No data yet.</div>}
            {result && (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style="text-align:left;border-bottom:1px solid #ddd;padding:8px">Item</th>
                      <th style="text-align:right;border-bottom:1px solid #ddd;padding:8px">Qty</th>
                      <th style="text-align:right;border-bottom:1px solid #ddd;padding:8px">Price</th>
                      <th style="text-align:right;border-bottom:1px solid #ddd;padding:8px">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>{it.name}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>{Number(it.quantity||1).toFixed(3)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>{Number(it.price||0).toFixed(3)}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                          {((Number(it.price)||0) * (Number(it.quantity)||1)).toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td />
                      <td />
                      <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>Subtotal</td>
                      <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>{Number(result.subtotal ?? computedSubtotal).toFixed(3)}</td>
                    </tr>
                    <tr>
                      <td />
                      <td />
                      <td style={{ padding: 8, textAlign: "right" }}>Tax</td>
                      <td style={{ padding: 8, textAlign: "right" }}>{result.tax != null ? Number(result.tax).toFixed(3) : "-"}</td>
                    </tr>
                    <tr>
                      <td />
                      <td />
                      <td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>Total</td>
                      <td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>{Number(result.total ?? computedSubtotal).toFixed(3)}</td>
                    </tr>
                  </tfoot>
                </table>

                <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!room ? (
                    <button onClick={startRoom} disabled={spinningRoom}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #111", background: "#111", color: "#fff", cursor: spinningRoom ? "not-allowed" : "pointer" }}>
                      {spinningRoom ? "Creating…" : "Start live room"}
                    </button>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, color: "#2e7d32" }}>Room <b>{room.id}</b> created ✓</span>
                      <a href={room.joinUrl} target="_blank" rel="noreferrer"
                        style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>
                        Open Room
                      </a>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 13, color: "#777" }}>
          BACKEND_URL: <code>{BACKEND_URL}</code>
        </div>
      </div>
    </div>
  );
}
