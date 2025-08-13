import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";

// Reuse your backend env var:
// - Local dev: http://localhost:5000
// - Prod: Vercel env VITE_BACKEND_URL should be set to the Railway URL
const isDev = import.meta.env.DEV;
const API_BASE = isDev
  ? import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
  : import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app";

export default function Room() {
  const { id: idFromParams } = useParams();

  // Fallback to parse from the hash if the router didn't fill params for any reason
  const roomId = useMemo(
    () => idFromParams || (window.location.hash.match(/\/room\/([^/?#]+)/)?.[1] ?? ""),
    [idFromParams]
  );

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!roomId) return;
    setErr("");
    setData(null);
    fetch(`${API_BASE}/session/${roomId}`, { headers: { Accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => setData(json))
      .catch((e) => setErr(e.message));
  }, [roomId]);

  if (!roomId) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <h2>Missing room id</h2>
        <p>Use a link like <code>#/room/B0A414</code>.</p>
        <Link to="/">← Back</Link>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#b00020" }}>
        <h2>Couldn’t load room {roomId}</h2>
        <p>Error: {err}</p>
        <p>The room may have expired after a backend restart. Ask the creator to share a fresh link.</p>
        <Link to="/">← Back</Link>
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>Loading…</div>;
  }

  // Support both shapes: flattened (items/subtotal/tax/total) and nested under data
  const items = data.items ?? data.data?.items ?? [];
  const subtotal = data.subtotal ?? data.data?.subtotal ?? null;
  const tax = data.tax ?? data.data?.tax ?? null;
  const total = data.total ?? data.data?.total ?? null;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>Room {data.id}</h2>
        <Link to="/" style={{ fontSize: 14 }}>← Back</Link>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Item</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Qty</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Price</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>{it.name}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                {Number(it.quantity ?? 1).toFixed(3)}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                {Number(it.price ?? 0).toFixed(3)}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                {((Number(it.price) || 0) * (Number(it.quantity) || 1)).toFixed(3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 420, gap: 8 }}>
        {subtotal != null && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Subtotal</span><b>{Number(subtotal).toFixed(3)}</b>
          </div>
        )}
        {tax != null && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Tax</span><b>{Number(tax).toFixed(3)}</b>
          </div>
        )}
        {total != null && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Total</span><b>{Number(total).toFixed(3)}</b>
          </div>
        )}
      </div>
    </div>
  );
}
