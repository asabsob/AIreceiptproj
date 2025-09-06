// src/pages/Room.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import { QRCodeCanvas } from "qrcode.react";

const isDev = import.meta.env.DEV;
const API_BASE = isDev
  ? (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000")
  : (import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app");

// Small avatar badge for names
function Avatar({ name }) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  const bg = `hsl(${hue} 90% 90%)`;
  const fg = `hsl(${hue} 70% 30%)`;
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color: fg,
        border: "1px solid #e5e7eb",
      }}
      title={name}
    >
      {initials || "?"}
    </div>
  );
}

export default function Room() {
  const { id } = useParams();
  const roomId = id || (window.location.hash.match(/\/live\/([^/?#]+)/)?.[1] ?? "");

  const [err, setErr] = useState("");
  const [data, setData] = useState(null);   // { items, subtotal?, tax?, total? }
  const [claims, setClaims] = useState([]); // Array<{ [userId]: number }>
  const [names, setNames] = useState({});   // { [userId]: string }
  const [presence, setPresence] = useState(0);
  const [youId, setYouId] = useState(null);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);

  // sticky display name
  const [displayName] = useState(() => {
    const saved = localStorage.getItem("displayName");
    if (saved) return saved;
    const n = "Guest-" + Math.random().toString(36).slice(2, 6);
    localStorage.setItem("displayName", n);
    return n;
  });

  /* ------------------------ helpers (no hooks) ------------------------ */
  const normClaims = (c) =>
    Array.isArray(c)
      ? c.map((row) =>
          row && typeof row === "object" && !Array.isArray(row) ? row : {}
        )
      : [];

  const safeEntries = (row) =>
    row && typeof row === "object" && !Array.isArray(row) ? Object.entries(row) : [];

  // ✅ price from parser is a UNIT price; line = unit * quantity
  const unitOf = (it) => Number(it?.price || 0);
  const qtyOf  = (it) => {
    const q = Number(it?.quantity ?? 1);
    return Number.isFinite(q) && q > 0 ? q : 1;
  };
  const lineOf = (it) => unitOf(it) * qtyOf(it);
  const money3 = (n) => (+(Number(n) || 0)).toFixed(3);

  /* -------------------- initial fetch (static data) ------------------- */
  useEffect(() => {
    if (!roomId) return;
    setErr("");
    fetch(`${API_BASE}/session/${roomId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => setData(json.data ?? json))
      .catch((e) => setErr(e.message));
  }, [roomId]);

  /* -------------------------- socket wiring --------------------------- */
  useEffect(() => {
    if (!roomId) return;
    const s = io(API_BASE, {
      withCredentials: false,
      transports: ["websocket", "polling"],
    });
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      setYouId(s.id);
      s.emit("join", { roomId, name: displayName });
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", (e) => console.warn("socket connect_error:", e?.message || e));

    s.on("room:error", ({ code }) => setErr(code || "room-error"));
    s.on("room:state", (payload) => {
      if (payload?.data) setData(payload.data);
      if (payload?.live?.claims) setClaims(normClaims(payload.live.claims));
      if (payload?.live?.names) setNames(payload.live.names);
    });
    s.on("room:live", (live) => {
      if (live?.claims) setClaims(normClaims(live.claims));
      if (live?.names) setNames(live.names);
    });
    s.on("room:presence", (p) => {
      if (typeof p?.count === "number") setPresence(p.count);
      if (p?.live?.names) setNames(p.live.names);
    });

    return () => s.disconnect();
  }, [roomId, displayName]);

  /* ----------------- derive values (hooks ALWAYS run) ----------------- */
  const items = Array.isArray(data?.items) ? data.items : [];
  const subtotalPrinted = Number.isFinite(+data?.subtotal) ? +data.subtotal : null;
  const totalPrinted    = Number.isFinite(+data?.total)    ? +data.total    : null;

  // Bill summary (falls back to computed if not printed)
  const subtotalAuto = useMemo(
    () => items.reduce((a, it) => a + lineOf(it), 0),
    [items]
  );
  const subtotal = subtotalPrinted != null ? subtotalPrinted : subtotalAuto;
  const total    = totalPrinted    != null ? totalPrinted    : subtotal;
  const fees     = Math.max(0, +(total - subtotal).toFixed(3));

  const sumClaims = (idx) =>
    safeEntries(claims[idx] || {}).reduce((a, [, q]) => a + (Number(q) || 0), 0);

  const remaining = (idx) => Math.max(0, qtyOf(items[idx]) - sumClaims(idx));
  const mineQty = (idx) => (youId ? Number((claims[idx] || {})[youId] || 0) : 0);

  const takenByOtherSingle = (idx) => {
    const qty = qtyOf(items[idx]);
    if (qty > 1) return false;
    const ent = safeEntries(claims[idx] || {});
    if (ent.length === 0) return false;
    if (!youId) return true;
    if (ent.length === 1) {
      const [uid, q] = ent[0];
      return uid !== youId && (Number(q) || 0) > 0;
    }
    return true;
  };

  const perUserTotals = useMemo(() => {
    try {
      const userBase = {};
      let baseSum = 0;

      items.forEach((it, idx) => {
        const u = unitOf(it);
        safeEntries(claims[idx] || {}).forEach(([uid, q]) => {
          const qty = Number(q) || 0;
          const share = u * qty;    // unit * claimed qty
          userBase[uid] = (userBase[uid] || 0) + share;
          baseSum += share;
        });
      });

      const out = {};
      const uids = Object.keys(userBase);
      for (const uid of uids) {
        const base = userBase[uid];
        const feeShare = baseSum > 0 ? fees * (base / baseSum) : (uids.length ? fees / uids.length : 0);
        out[uid] = +(base + feeShare).toFixed(3);
      }
      return out;
    } catch (e) {
      console.error("perUserTotals failed:", e);
      return {};
    }
  }, [claims, items, fees]);

  const yourTotal =
    youId && Number.isFinite(+perUserTotals[youId]) ? perUserTotals[youId] : 0;

  /* --------------------------- early UI returns ------------------------ */
  if (!roomId) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui,sans-serif" }}>
        <h2>Missing room id</h2>
        <p>
          Use a link like <code>#/room/ABC123</code>.
        </p>
        <Link to="/">← Back</Link>
      </div>
    );
  }
  if (err) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui,sans-serif", color: "#b00020" }}>
        <h2>Couldn’t load room {roomId}</h2>
        <p>Error: {err}</p>
        <Link to="/">← Back</Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui,sans-serif" }}>
        Loading…
      </div>
    );
  }

  /* ------------------------------- render ------------------------------ */
  const joinUrl = window.location.href;

  const claimOne = (idx) => {
    if (!connected) return;
    socketRef.current?.emit("room:claim", { index: idx, qty: 1 }, (res) => {
      if (!res?.ok) console.warn("claim failed:", res?.error);
    });
  };
  const unclaimOne = (idx) => {
    if (!connected) return;
    socketRef.current?.emit("room:unclaim", { index: idx, qty: 1 }, (res) => {
      if (!res?.ok) console.warn("unclaim failed:", res?.error);
    });
  };

  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui,sans-serif",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Live room {roomId}</h2>
          <div style={{ color: "#666", fontSize: 13 }}>
            People online: <b>{presence || "-"}</b> • You are{" "}
            <b>{displayName}</b> • Socket:{" "}
            <b style={{ color: connected ? "#2e7d32" : "#b00020" }}>
              {connected ? "connected" : "connecting…"}
            </b>
          </div>
        </div>
        <Link to="/" style={{ fontSize: 14 }}>
          ← Back
        </Link>
      </div>

      {/* share */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <QRCodeCanvas value={joinUrl} size={140} includeMargin />
        <div style={{ fontSize: 13, wordBreak: "break-all" }}>
          <div style={{ color: "#555", marginBottom: 6 }}>Share this link:</div>
          <code>{joinUrl}</code>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(joinUrl);
                  alert("Link copied!");
                } catch {
                  window.prompt("Copy link:", joinUrl);
                }
              }}
              style={{
                padding: "6px 10px",
                border: "1px solid #ddd",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Copy link
            </button>
          </div>
        </div>
      </div>

      {/* bill summary */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "stretch",
        }}
      >
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, minWidth: 240 }}>
          <h3 style={{ margin: "4px 0 8px" }}>Bill summary</h3>
          <div style={{ display: "grid", rowGap: 6 }}>
            <div>Subtotal: <b>{money3(subtotal)}</b></div>
            <div>Tax/Fees: <b>{money3(fees)}</b></div>
            <div>Total due: <b>{money3(total)}</b></div>
          </div>
        </div>
      </div>

      {/* items */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 16,
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
              Item
            </th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
              Qty
            </th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
              Unit
            </th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
              Line total
            </th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
              Claims
            </th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const unit = unitOf(it);
            const qty = qtyOf(it);
            const row = claims[idx] || {};
            const left = remaining(idx);
            const my = mineQty(idx);

            const single = qty <= 1;
            const lockedByOther = takenByOtherSingle(idx);

            const canTake = connected && (single ? !lockedByOther && left > 0 : left > 0);
            const canDrop = connected && my > 0;

            return (
              <tr key={idx}>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>{it.name}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                  {qty.toFixed(3)}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                  {unit.toFixed(3)}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                  {(unit * qty).toFixed(3)}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>
                  <div style={{ fontSize: 13, display: "grid", gap: 6 }}>
                    {safeEntries(row).length === 0 && <span style={{ color: "#777" }}>—</span>}
                    {safeEntries(row).map(([uid, q]) => (
                      <div key={uid} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Avatar name={names[uid] || uid} />
                        <span>
                          <b>{names[uid] || uid}</b>: {Number(q).toFixed(3)}
                        </span>
                      </div>
                    ))}
                    <div
                      style={{
                        marginTop: 4,
                        color: left === 0 ? "#2e7d32" : "#b06a00",
                      }}
                    >
                      Remaining: <b>{left.toFixed(3)}</b>
                    </div>
                  </div>
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #f1f1f1",
                    textAlign: "right",
                  }}
                >
                  <div style={{ display: "inline-flex", gap: 8 }}>
                    <button
                      onClick={() => claimOne(idx)}
                      disabled={!canTake}
                      title={connected ? (single ? "Claim this item" : "Claim 1 unit") : "Connecting…"}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        cursor: canTake ? "pointer" : "not-allowed",
                        background: canTake ? "#111" : "#eee",
                        color: canTake ? "#fff" : "#999",
                      }}
                    >
                      {single ? "Claim" : "+1"}
                    </button>
                    <button
                      onClick={() => unclaimOne(idx)}
                      disabled={!canDrop}
                      title={connected ? (single ? "Release" : "Return 1 unit") : "Connecting…"}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        cursor: canDrop ? "pointer" : "not-allowed",
                        background: "white",
                      }}
                    >
                      {single ? "−1" : "−1"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* per-user totals */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          maxWidth: 520,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Totals (incl. pro-rated fees/tax)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.keys(perUserTotals).length === 0 && (
            <div style={{ color: "#777" }}>No selections yet.</div>
          )}
          {Object.entries(perUserTotals).map(([uid, amt]) => (
            <div key={uid} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {names[uid] || uid}
                {uid === youId ? " (you)" : ""}
              </span>
              <b>{money3(amt)}</b>
            </div>
          ))}
        </div>
        {youId && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#333" }}>
            Your current total: <b>{money3(yourTotal)}</b>
          </div>
        )}
      </div>
    </div>
  );
}
