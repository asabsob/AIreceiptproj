import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "../components/Header.jsx";

const isDev = import.meta.env.DEV;
const API_BASE = isDev
  ? (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000")
  : (import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app");

export default function Room() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true); setErr("");
    fetch(`${API_BASE}/session/${id}`, { headers: { Accept: "application/json" } })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(json => setData(json))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const items = data?.items ?? data?.data?.items ?? [];
  const subtotal = data?.subtotal ?? data?.data?.subtotal ?? null;
  const tax = data?.tax ?? data?.data?.tax ?? null;
  const total = data?.total ?? data?.data?.total ?? null;

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <Header />
      <div style={{padding:16}}>
      Room {id} OK &nbsp; <Link to="/">← Back</Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>Room {id}</h2>
          <Link to="/" style={{ fontSize: 14 }}>← Back</Link>
        </div>

        {loading && <div style={{ marginTop: 12 }}>Loading…</div>}
        {err && <div style={{ marginTop: 12, color: "#b00020" }}>Error: {err}</div>}

        {!loading && !err && (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Item</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Qty</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Price</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Line total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>{it.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>{Number(it.quantity ?? 1).toFixed(3)}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>{Number(it.price ?? 0).toFixed(3)}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                      {((Number(it.price)||0) * (Number(it.quantity)||1)).toFixed(3)}
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
          </>
        )}
      </div>
    </div>
  );
}
