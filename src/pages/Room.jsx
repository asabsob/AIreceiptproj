// src/pages/Room.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import { QRCodeCanvas } from "qrcode.react";

const isDev = import.meta.env.DEV;
const API_BASE = isDev
  ? import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
  : import.meta.env.VITE_BACKEND_URL ||
    "https://aireceiptsplit-backend-production.up.railway.app";

/* --------------------------------- UI bits -------------------------------- */
function Avatar({ name }) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
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

/* ---------------------- detect unit vs. line total shape ------------------- */
/** Decide whether `price` is a line total ("line") or a unit price ("unit"). */
function chooseUnitMode(items, subtotalPrinted) {
  if (!Array.isArray(items) || items.length === 0) return "line";

  const sumLine = items.reduce((a, it) => a + (+it.price || 0), 0); // price already line total
  const sumUnit = items.reduce(
    (a, it) => a + (+it.price || 0) * (+it.quantity || 1),
    0
  ); // price is unit * qty

  if (typeof subtotalPrinted !== "number" || !isFinite(subtotalPrinted)) {
    // No printed subtotal: pick the “smaller sum” interpretation (safer).
    return sumLine <= sumUnit ? "line" : "unit";
  }
  const d1 = Math.abs(sumLine - subtotalPrinted);
  const d2 = Math.abs(sumUnit - subtotalPrinted);
  return d1 <= d2 ? "line" : "unit";
}

/* ================================= Room =================================== */
export default function Room() {
  const { id } = useParams();
  const roomId = id || (window.location.hash.match(/\/live\/([^/?#]+)/)?.[1] ?? "");

  const [err, setErr] = useState("");
  const [data, setData] = useState(null);        // { items, subtotal?, tax?, total? }
  const [claims, setClaims] = useState([]);      // Array<Record<userId, number>>
  const [names, setNames] = useState({});        // userId -> display name
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

  /* ------------------------ helpers (static) ------------------------ */
  const normClaims = (c) =>
    Array.isArray(c)
      ? c.map((row) =>
          row && typeof row === "object" && !Array.isArray(row) ? row : {}
        )
      : [];
  const safeEntries = (row) =>
    row && typeof row === "object" && !Array.isArray(row)
      ? Object.entries(row)
      : [];

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
    s.on("connect_error", (e) =>
      console.warn("socket connect_error:", e?.message || e)
    );

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

  /* ----------------- derive values (always run hooks) ----------------- */
  const items = Array.isArray(data?.items) ? data.items : [];
  const subtotalPrinted = Number.isFinite(+data?.subtotal)
    ? Number(data.subtotal)
    : null;
  const totalPrinted = Number.isFinite(+data?.total) ? Number(data.total) : null;

  const unitMode = useMemo(
    () => chooseUnitMode(items, subtotalPrinted),
    [items, subtotalPrinted]
  );

  // Compute unit price per item depending on the detected mode.
  function getUnit(it) {
    const qty = Math.max(1, Number(it?.quantity ?? 1));
    const price = Number(it?.price ?? 0);
    return unitMode === "unit" ? price : price / qty;
  }

  const sumClaims = (idx) =>
    safeEntries(claims[idx] || {}).reduce(
      (a, [, q]) => a + (Number(q) || 0),
      0
    );
  const remaining = (idx) =>
    Math.max(0, Number(items[idx]?.quantity ?? 1) - sumClaims(idx));
  const mineQty = (idx) =>
    youId ? Number((claims[idx] || {})[youId] || 0) : 0;

  const takenByOtherSingle = (idx) => {
    const qty = Number(items[idx]?.quantity ?? 1);
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
        const unit = getUnit(it);
        safeEntries(claims[idx] || {}).forEach(([uid, q]) => {
          const qty = Number(q) || 0;
          userBase[uid] = (userBase[uid] || 0) + unit * qty;
          baseSum += unit * qty;
        });
      });

      const subtotal =
        subtotalPrinted != null
          ? subtotalPrinted
          : items.reduce(
              (a, it) => a + getUnit(it) * (Number(it.quantity ?? 1)),
              0
            );

      const total = totalPrinted != null ? totalPrinted : subtotal;
      const fees = Math.max(0, +(total - subtotal).toFixed(3));

      const out = {};
      const uids = Object.keys(userBase);
      for (const uid of uids) {
        const base = userBase[uid];
        const feeShare =
          baseSum > 0
            ? fees * (base / baseSum)
            : uids.length
            ? fees / uids.length
            : 0;
        out[uid] = +(base + feeShare).toFixed(3);
      }
      return out;
    } catch (e) {
      console.error("perUserTotals failed:", e);
      return {};
    }
  }, [claims, items, subtotalPrinted, totalPrinted, unitMode]);

  const yourTotal =
    youId && Number.isFinite(+perUserTotals[youId])
      ? perUserTotals[youId]
      : 0;

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
      <div
        style={{
          padding: 16,
          fontFamily: "system-ui,sans-serif",
          color: "#b00020",
        }}
      >
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
  const computedSubtotal =
    subtotalPrinted ??
    items.reduce((a, it) => a + getUnit(it) * (Number(it.quantity ?? 1)), 0);
  const computedTotal = totalPrinted ?? computedSubtotal;
  const computedFees = +(computedTotal - computedSubtotal).toFixed(3);

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

  const splitsSum = Object.values(perUserTotals).reduce(
    (a, b) => a + (+b || 0),
    0
  );

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
            People online: <b>{presence || "-"}</b> • You are <b>{displayName}</b> •
            Socket:{" "}
            <b style={{ color: connected ? "#2e7d32" : "#b00020" }}>
              {connected ? "connected" : "connecting…"}
            </b>{" "}
            • Items mode: <b>{unitMode === "unit" ? "unit price" : "line total"}</b>
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
          marginTop: 16,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          maxWidth: 520,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Bill summary</h3>
        <div style={{ display: "grid", rowGap: 10, fontSize: 18 }}>
          <div>
            <span style={{ color: "#555", marginRight: 8 }}>Subtotal:</span>
            <b>{computedSubtotal.toFixed(3)}</b>
          </div>
          <div>
            <span style={{ color: "#555", marginRight: 8 }}>Tax/Fees:</span>
            <b>{computedFees.toFixed(3)}</b>
          </div>
          <div>
            <span style={{ color: "#555", marginRight: 8 }}>Total due:</span>
            <b>{computedTotal.toFixed(3)}</b>
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
            const unit = getUnit(it);
            const qty = Number(it.quantity ?? 1);
            const row = claims[idx] || {};
            const left = remaining(idx);
            const my = mineQty(idx);

            const single = qty <= 1;
            const lockedByOther = takenByOtherSingle(idx);

            const canTake =
              connected && (single ? !lockedByOther && left > 0 : left > 0);
            const canDrop = connected && my > 0;

            return (
              <tr key={idx}>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>
                  {it.name}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #f1f1f1",
                    textAlign: "right",
                  }}
                >
                  {qty.toFixed(3)}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #f1f1f1",
                    textAlign: "right",
                  }}
                >
                  {unit.toFixed(3)}
                </td>
                <td
                  style={{
                    padding: 8,
                    borderBottom: "1px solid #f1f1f1",
                    textAlign: "right",
                  }}
                >
                  {(unit * qty).toFixed(3)}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>
                  <div style={{ fontSize: 13, display: "grid", gap: 6 }}>
                    {safeEntries(row).length === 0 && (
                      <span style={{ color: "#777" }}>—</span>
                    )}
                    {safeEntries(row).map(([uid, q]) => (
                      <div
                        key={uid}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
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
                      title={
                        connected
                          ? single
                            ? "Claim this item"
                            : "Claim 1 unit"
                          : "Connecting…"
                      }
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
                      title={
                        connected
                          ? single
                            ? "Release"
                            : "Return 1 unit"
                          : "Connecting…"
                      }
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

      {/* totals */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          maxWidth: 700,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Totals (incl. pro-rated fees/tax)</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            alignItems: "center",
          }}
        >
          {Object.keys(perUserTotals).length === 0 && (
            <div style={{ color: "#777" }}>No selections yet.</div>
          )}
          {Object.entries(perUserTotals).map(([uid, amt]) => (
            <div
              key={uid}
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <span>
                {names[uid] || uid}
                {uid === youId ? " (you)" : ""}
              </span>
              <b>{(Number(amt) || 0).toFixed(3)}</b>
            </div>
          ))}
        </div>
        {youId && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#333" }}>
            Your current total: <b>{(Number(yourTotal) || 0).toFixed(3)}</b>
          </div>
        )}
        <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
          Split covers <b>{splitsSum.toFixed(3)}</b> of{" "}
          <b>{computedTotal.toFixed(3)}</b>
        </div>
      </div>
    </div>
  );
}
