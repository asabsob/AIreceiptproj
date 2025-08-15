import React, { useMemo, useState } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import { Link } from "react-router-dom";

const isDev = import.meta.env.DEV;
const BACKEND_URL = isDev
  ? import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
  : import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [room, setRoom] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    setRoom(null);
    setResult(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await axios.post(`${BACKEND_URL}/parse`, form, { timeout: 60000 });
      setResult(data);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.error || e.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const startLiveRoom = async () => {
    if (!result || creating) return;
    setCreating(true);
    try {
      const { data } = await axios.post(`${BACKEND_URL}/session`, { data: result }, { timeout: 20000 });
      setRoom(data); // {id, joinUrl}
    } catch (e) {
      alert("Could not start a live room. Try again.");
    } finally {
      setCreating(false);
    }
  };

  // numbers
  const computedSubtotal =
    result?.items?.reduce(
      (a, it) => a + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    ) ?? 0;

  const subtotal = result?.subtotal ?? computedSubtotal;
  const tax = result?.tax ?? null;
  const total = result?.total ?? subtotal;
  const fees = +(Number(total ?? 0) - Number(subtotal ?? 0)).toFixed(3);
  const otherFees = tax != null ? +(fees - Number(tax)).toFixed(3) : null;

  const roomUrl = room?.joinUrl || (room?.id ? `${window.location.origin}/#/room/${room.id}` : "");
  const canStart = !!result && !room;

  return (
    <div className="row">
      {/* Left: upload */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Receipt image</h2>
        <input type="file" accept="image/*" onChange={onFile} />
        {preview && (
          <div style={{ marginTop: 12 }}>
            <img src={preview} alt="preview" style={{ maxWidth: "100%", borderRadius: 12, border: "1px solid #eee" }}/>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={handleSubmit} disabled={!file || loading}>
            {loading ? "Parsing…" : "Parse receipt"}
          </button>
        </div>
        {error && <div className="warn" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {/* Right: parsed table */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Parsed result</h2>
        {!result && <div className="muted">No data yet.</div>}

        {result && (
          <>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Price</th>
                  <th style={{ textAlign: "right" }}>Line total</th>
                </tr>
              </thead>
              <tbody>
                {result.items?.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.name}</td>
                    <td style={{ textAlign: "right" }}>{Number(it.quantity ?? 1).toFixed(3)}</td>
                    <td style={{ textAlign: "right" }}>{Number(it.price ?? 0).toFixed(3)}</td>
                    <td style={{ textAlign: "right" }}>
                      {((Number(it.price) || 0) * (Number(it.quantity) || 1)).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <td />
                  <td style={{ textAlign: "right", fontWeight: 600 }}>Subtotal</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{Number(subtotal).toFixed(3)}</td>
                </tr>
                {tax != null && (
                  <tr>
                    <td />
                    <td />
                    <td style={{ textAlign: "right" }}>Tax</td>
                    <td style={{ textAlign: "right" }}>{Number(tax).toFixed(3)}</td>
                  </tr>
                )}
                <tr>
                  <td />
                  <td />
                  <td style={{ textAlign: "right" }}>{tax != null ? "Other fees" : "Fees"}</td>
                  <td style={{ textAlign: "right" }}>
                    {(tax != null ? otherFees : fees).toFixed(3)}
                  </td>
                </tr>
                <tr>
                  <td />
                  <td />
                  <td style={{ textAlign: "right", fontWeight: 700 }}>Total</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{Number(total).toFixed(3)}</td>
                </tr>
              </tfoot>
            </table>

            <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              {canStart && (
                <button className="btn primary" onClick={startLiveRoom} disabled={creating}>
                  {creating ? "Starting…" : "Start live room"}
                </button>
              )}
              {room && (
                <>
                  <span className="ok">Room <b>{room.id}</b> created ✓</span>
                  <Link to={`/room/${room.id}`} className="btn">Open room</Link>
                </>
              )}
            </div>

            {room && (
              <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <QRCodeCanvas value={roomUrl} size={180} includeMargin />
                <div style={{ maxWidth: 520 }}>
                  <div className="muted" style={{ marginBottom: 6 }}>Share or scan this link:</div>
                  <code>{roomUrl}</code>
                </div>
              </div>
            )}

            <details style={{ marginTop: 16 }}>
              <summary>Raw JSON</summary>
              <pre style={{ background: "#fafafa", padding: 12, borderRadius: 8 }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </>
        )}

        <div className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          Tip: set <code>VITE_BACKEND_URL</code> in Vercel to your Railway URL.{" "}
          <Link to="/room/2A6A98">Sample room link</Link>
        </div>
      </div>
    </div>
  );
}
