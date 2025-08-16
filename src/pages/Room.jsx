// src/pages/Room.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import { QRCodeCanvas } from "qrcode.react";
import { normalizeReceipt } from "../lib/normalize.js";

const isDev = import.meta.env.DEV;
const BACKEND_URL = isDev
  ? import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
  : import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app";

export default function Room() {
  const { id: paramId } = useParams();
  const roomId = useMemo(
    () => paramId || (window.location.hash.match(/\/live\/([^/?#]+)/)?.[1] ?? ""),
    [paramId]
  );

  const [receipt, setReceipt] = useState(null); // { items[ {price(unit), quantity} ], subtotal, tax, total }
  const [err, setErr] = useState("");
  const [socketId, setSocketId] = useState("");
  const [claims, setClaims] = useState([]);     // Array< { [uid]: qty } >
  const [names, setNames] = useState({});       // { uid: displayName }
  const [peers, setPeers] = useState(1);

  // Fetch room payload (immutable)
  useEffect(() => {
    if (!roomId) return;
    setErr("");
    fetch(`${BACKEND_URL}/session/${roomId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const norm = normalizeReceipt(json.data || json); // normalize to ensure unit prices
        setReceipt({ id: json.id, ...norm });
      })
      .catch((e) => setErr(e.message));
  }, [roomId]);

  // Socket live state
  useEffect(() => {
    if (!roomId) return;
    const s = io(BACKEND_URL, { transports: ["websocket"] });

    s.on("connect", () => setSocketId(s.id));
    s.emit("join", { roomId, name: "" });

    s.on("room:state", (snap) => {
      // snap.data is the immutable receipt shape
      const norm = normalizeReceipt(snap.data || {});
      setReceipt({ id: snap.id, ...norm });

      // live: claims & names may be plain objects from server
      setClaims(Array.isArray(snap.live?.claims) ? snap.live.claims : []);
      setNames(snap.live?.names || {});
    });

    s.on("room:live", (live) => {
      setClaims(Array.isArray(live?.claims) ? live.claims : []);
      setNames(live?.names || {});
    });

    s.on("room:presence", ({ count, live }) => {
      setPeers(count || 1);
      if (live?.names) setNames(live.names);
    });

    s.on("room:error", ({ code }) => setErr(code || "room-error"));

    return () => s.disconnect();
  }, [roomId]);

  // Actions
  const claim = (index, qty = 1) =>
    window.socket?.emit
      ? window.socket.emit("room:claim", { index, qty }, () => {})
      : io(BACKEND_URL).emit("room:claim", { index, qty });

  const unclaim = (index, qty = 1) =>
    window.socket?.emit
      ? window.socket.emit("room:unclaim", { index, qty }, () => {})
      : io(BACKEND_URL).emit("room:unclaim", { index, qty });

  // Compute remaining per line
  const remainingFor = (idx) => {
    const row = claims[idx] || {};
    const sum = Object.values(row).reduce((a, b) => a + (Number(b) || 0), 0);
    const qty = Number(receipt?.items?.[idx]?.quantity || 0);
    return Math.max(0, +(qty - sum).toFixed(3));
  };

  // === Per-user totals ===
  const perUserTotals = useMemo(() => {
    if (!receipt) return { base: {}, final: {}, ids: [] };

    // Build base total per user from claims
    const base = {};
    (receipt.items || []).forEach((it, idx) => {
      const unit = Number(it.price) || 0; // unit price
      const row = claims[idx] || {};
      for (const [uid, q] of Object.entries(row)) {
        base[uid] = (base[uid] || 0) + unit * (Number(q) || 0);
      }
    });

    const ids = Array.from(
      new Set(Object.keys({ ...names, ...base }))
    );

    const subtotal = Number(receipt.subtotal || 0);
    const total = Number(
      receipt.total != null ? receipt.total : subtotal + (Number(receipt.tax) || 0)
    );
    const fees = Math.max(0, +(total - subtotal).toFixed(3));

    const sumBase = Object.values(base).reduce((a, b) => a + b, 0);
    const final = {};
    if (sumBase > 0) {
      ids.forEach((uid) => {
        const b = base[uid] || 0;
        const feeShare = fees * (b / sumBase);
        final[uid] = +(b + feeShare).toFixed(3);
      });
    } else {
      // nobody claimed yet → split fees evenly across present users
      const n = Math.max(ids.length, 1);
      const even = +(fees / n).toFixed(3);
      ids.forEach((uid) => (final[uid] = even));
    }

    return { base, final, ids };
  }, [claims, names, receipt]);

  if (!roomId) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Missing room id</h2>
        <p>Use a link like <code>#/live/ABCDE1</code>.</p>
        <Link to="/">← Back</Link>
      </div>
    );
  }
  if (err) {
    return (
      <div style={{ padding: 16, color: "#b00020" }}>
        <h2>Couldn’t load room {roomId}</h2>
        <p>Error: {err}</p>
        <Link to="/">← Back</Link>
      </div>
    );
  }
  if (!receipt) return <div style={{ padding: 16 }}>Loading…</div>;

  const shareUrl = `${window.location.origin}/#/live/${roomId}`;

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16, fontFamily: "system-ui,sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Room {receipt.id}</h2>
        <Link to="/" style={{ fontSize: 14 }}>← Back</Link>
      </div>

      {/* QR / Share */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <QRCodeCanvas value={shareUrl} size={160} includeMargin />
        <div style={{ fontSize: 13, wordBreak: "break-all" }}>
          Share this room:
          <div><code>{shareUrl}</code></div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#555" }}>
          People online: <b>{peers}</b>
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginTop: 10, color: "#666" }}>
        Subtotal: <b>{receipt.subtotal.toFixed(3)}</b> &nbsp;•&nbsp;
        Tax/Fees: <b>{(+((receipt.total ?? 0) - (receipt.subtotal ?? 0))).toFixed(3)}</b> &nbsp;•&nbsp;
        Total: <b>{Number(receipt.total ?? receipt.subtotal).toFixed(3)}</b>
      </div>

      {/* Items */}
      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Items</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Item</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Qty</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Unit</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Line Total</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Who / Actions</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((it, idx) => {
              const row = claims[idx] || {};
              const my = Number(row[socketId] || 0);
              const remaining = remainingFor(idx);
              return (
                <tr key={idx}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>{it.name}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                    {Number(it.quantity).toFixed(3)}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                    {Number(it.price).toFixed(3)}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                    {(Number(it.price) * Number(it.quantity)).toFixed(3)}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        disabled={remaining <= 0}
                        onClick={() => claim(idx, 1)}
                        style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer" }}
                        title={remaining > 0 ? "Take 1 unit" : "No units remaining"}
                      >
                        +1
                      </button>
                      <button
                        disabled={my <= 0}
                        onClick={() => unclaim(idx, 1)}
                        style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer" }}
                        title={my > 0 ? "Release 1 unit" : "You have none"}
                      >
                        −1
                      </button>
                      <span style={{ fontSize: 12, color: remaining === 0 ? "#b00020" : "#555" }}>
                        Remaining: <b>{remaining.toFixed(3)}</b> &nbsp;•&nbsp; You: <b>{my.toFixed(3)}</b>
                      </span>
                    </div>

                    {/* Who has what */}
                    <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                      {Object.entries(row).length === 0 ? (
                        <span style={{ color: "#777" }}>— nobody yet</span>
                      ) : (
                        Object.entries(row).map(([uid, q]) => (
                          <span key={uid} style={{ border: "1px solid #eee", borderRadius: 6, padding: "2px 6px" }}>
                            {names[uid] || uid.slice(0, 6)}: {Number(q).toFixed(3)}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Per-person totals (fees included) */}
      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Totals per person</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 520, gap: 8 }}>
          {perUserTotals.ids.map((uid) => (
            <div key={uid} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #eee", padding: "6px 8px" }}>
              <span>{names[uid] || uid.slice(0, 6)}</span>
              <b>{(perUserTotals.final[uid] || 0).toFixed(3)}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
