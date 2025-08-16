import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";
import { QRCodeCanvas } from "qrcode.react";

const isDev = import.meta.env.DEV;
const API_BASE = isDev
  ? (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000")
  : (import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app");

export default function Room() {
  const { id } = useParams();
  const roomId = id || (window.location.hash.match(/\/live\/([^/?#]+)/)?.[1] ?? "");

  const [err, setErr] = useState("");
  const [data, setData] = useState(null);         // { items, subtotal?, tax?, total? }
  const [claims, setClaims] = useState([]);       // Array<{ [userId]: number }>
  const [names, setNames]   = useState({});       // { [userId]: string }
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

  /* ------------------------ helpers ------------------------ */
  const normClaims = (c) =>
    Array.isArray(c) ? c.map((row) => (row && typeof row === "object" && !Array.isArray(row) ? row : {})) : [];

  const safeEntries = (row) =>
    row && typeof row === "object" && !Array.isArray(row) ? Object.entries(row) : [];

  // Treat `price` as line total; divide by quantity for unit
  const getUnit = (it) => {
    const qty = Math.max(0, Number(it?.quantity ?? 1));
    const line = Number(it?.price ?? 0);
    return qty > 0 ? line / qty : 0;
  };

  /* -------------------- fetch static data ------------------- */
  useEffect(() => {
    if (!roomId) return;
    setErr("");
    fetch(`${API_BASE}/session/${roomId}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => setData(json.data ?? json))
      .catch((e) => setErr(e.message));
  }, [roomId]);

  /* --------------------- socket wiring ---------------------- */
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

  /* ----------------- derived values (safe) ------------------ */
  const items = Array.isArray(data?.items) ? data.items : [];
  const subtotalPrinted = Number.isFinite(+data?.subtotal) ? Number(data.subtotal) : null;
  const totalPrinted    = Number.isFinite(+data?.total)    ? Number(data.total)    : null;

  const sumClaims = (idx) => safeEntries(claims[idx] || {}).reduce((a, [, q]) => a + (Number(q) || 0), 0);
  const remaining = (idx) => Math.max(0, Number(items[idx]?.quantity ?? 1) - sumClaims(idx));
  const mineQty   = (idx) => (youId ? Number((claims[idx] || {})[youId] || 0) : 0);

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
      const userBase = {}; // userId -> sum of (unit * claimedQty)
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
          : items.reduce((a, it) => a + getUnit(it) * (Number(it.quantity ?? 1)), 0);

      const total =
        totalPrinted != null
          ? totalPrinted
          : subtotal;

      const fees = Math.max(0, +(total - subtotal).toFixed(3));

      const out = {};
      const uids = Object.keys(userBase);
      for (const uid of uids) {
        const base = userBase[uid];
        const feeShare = baseSum > 0 ? (fees * (base / baseSum)) : (uids.length ? fees / uids.length : 0);
        out[uid] = +(base + feeShare).toFixed(3);
      }
      return out;
    } catch (e) {
      console.error("perUserTotals failed:", e);
      return {};
    }
  }, [claims, items, subtotalPrinted, totalPrinted]);

  const yourTotal = youId && Number.isFinite(+perUserTotals[youId]) ? perUserTotals[youId] : 0;

  /* --------------------------- UI guards -------------------- */
  if (!roomId) {
    return (
      <div className="container">
        <div className="card error">
          <h3>Missing room id</h3>
          <p>Use a link like <code>#/live/ABC123</code>.</p>
          <Link to="/" className="btn">← Back</Link>
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="container">
        <div className="card error">
          <h3>Couldn’t load room {roomId}</h3>
          <p>{err}</p>
          <Link to="/" className="btn">← Back</Link>
        </div>
      </div>
    );
  }
  if (!data) return <div className="container"><div className="muted">Loading…</div></div>;

  /* -------------------------- actions ----------------------- */
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

  const joinUrl = window.location.href;

  return (
    <div className="container">
      {/* Top header */}
      <header className="page-head row between">
        <div className="stack-2">
          <h1 className="title">Live room {roomId}</h1>
          <div className="muted small row gap-2 wrap">
            <span>People online: <b>{presence || "-"}</b></span>
            <span>• You are <b>{displayName}</b></span>
            <span className={`chip ${connected ? "chip-ok" : "chip-warn"}`}>
              {connected ? "Socket connected" : "Connecting…"}
            </span>
          </div>
        </div>
        <Link to="/" className="btn btn-ghost">← Back</Link>
      </header>

      {/* Share card */}
      <section className="card row gap-4 wrap align-center">
        <div className="qr">
          <QRCodeCanvas value={joinUrl} size={140} includeMargin />
        </div>
        <div className="stack-2">
          <div className="muted small">Share this link</div>
          <code className="code-block">{joinUrl}</code>
          <div className="row gap-2">
            <button
              className="btn btn-primary"
              onClick={async () => {
                try { await navigator.clipboard.writeText(joinUrl); }
                catch { window.prompt("Copy link:", joinUrl); }
              }}
            >
              Copy link
            </button>
          </div>
        </div>
      </section>

      {/* Items table */}
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="left">Item</th>
                <th className="right">Qty</th>
                <th className="right">Unit</th>
                <th className="right">Line total</th>
                <th className="left">Claims</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const unit = getUnit(it);
                const qty  = Number(it.quantity ?? 1);
                const row  = claims[idx] || {};
                const left = remaining(idx);
                const my   = mineQty(idx);

                const single = qty <= 1;
                const lockedByOther = takenByOtherSingle(idx);

                const canTake = connected && (single ? (!lockedByOther && left > 0) : left > 0);
                const canDrop = connected && my > 0;

                return (
                  <tr key={idx}>
                    <td className="left">{it.name}</td>
                    <td className="right">{qty.toFixed(3)}</td>
                    <td className="right">{unit.toFixed(3)}</td>
                    <td className="right">{(unit * qty).toFixed(3)}</td>
                    <td className="left">
                      <div className="stack-1 small">
                        {safeEntries(row).length === 0 && <span className="muted">—</span>}
                        {safeEntries(row).map(([uid, q]) => (
                          <div key={uid} className="row gap-2 align-center">
                            <Avatar name={names[uid] || uid} />
                            <span><b>{names[uid] || uid}</b>: {Number(q).toFixed(3)}</span>
                          </div>
                        ))}
                        <div className={`chip ${left === 0 ? "chip-ok" : "chip-warn"}`}>
                          Remaining: {left.toFixed(3)}
                        </div>
                      </div>
                    </td>
                    <td className="right">
                      <div className="row gap-2 justify-end">
                        <button
                          className={`btn btn-dark ${!canTake ? "btn-disabled" : ""}`}
                          onClick={() => claimOne(idx)}
                          disabled={!canTake}
                          title={connected ? (single ? "Claim this item" : "Claim 1 unit") : "Connecting…"}
                        >
                          {single ? "Claim" : "+1"}
                        </button>
                        <button
                          className={`btn ${!canDrop ? "btn-disabled" : ""}`}
                          onClick={() => unclaimOne(idx)}
                          disabled={!canDrop}
                          title={connected ? (single ? "Release" : "Return 1 unit") : "Connecting…"}
                        >
                          {single ? "Release" : "−1"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Totals card */}
      <section className="card stack-2 max-520">
        <h3 className="subtitle">Totals (incl. pro-rated fees/tax)</h3>
        {Object.keys(perUserTotals).length === 0 ? (
          <div className="muted">No selections yet.</div>
        ) : (
          <div className="list">
            {Object.entries(perUserTotals).map(([uid, amt]) => (
              <div key={uid} className="row between align-center">
                <div className="row gap-2 align-center">
                  <Avatar name={names[uid] || uid} />
                  <span>
                    {names[uid] || uid}{uid === youId ? " (you)" : ""}
                  </span>
                </div>
                <b>{(Number(amt) || 0).toFixed(3)}</b>
              </div>
            ))}
          </div>
        )}
        {youId && (
          <div className="muted small">
            Your current total: <b>{(Number(yourTotal) || 0).toFixed(3)}</b>
          </div>
        )}
      </section>
    </div>
  );
}

/* --------- tiny inline component using your CSS tokens --------- */
function Avatar({ name }) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  // stable hue from name
  let hash = 0; for (let i = 0; i < (name || "").length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;

  return (
    <div
      className="avatar"
      style={{
        background: `hsl(${hue} 90% 90%)`,
        color: `hsl(${hue} 70% 30%)`
      }}
      title={name}
    >
      {initials || "?"}
    </div>
  );
}
