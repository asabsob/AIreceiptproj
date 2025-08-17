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
  const [data, setData] = useState(null);
  const [claims, setClaims] = useState([]);
  const [names, setNames] = useState({});
  const [presence, setPresence] = useState(0);
  const [youId, setYouId] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  const [displayName] = useState(() => {
    const saved = localStorage.getItem("displayName");
    if (saved) return saved;
    const n = "Guest-" + Math.random().toString(36).slice(2, 6);
    localStorage.setItem("displayName", n);
    return n;
  });

  const normClaims = (c) =>
    Array.isArray(c) ? c.map((row) => (row && typeof row === "object" && !Array.isArray(row) ? row : {})) : [];
  const safeEntries = (row) =>
    row && typeof row === "object" && !Array.isArray(row) ? Object.entries(row) : [];
  const getUnit = (it) => {
    const qty = Math.max(0, Number(it?.quantity ?? 1));
    const line = Number(it?.price ?? 0);
    return qty > 0 ? line / qty : 0;
  };

  useEffect(() => {
    if (!roomId) return;
    setErr("");
    fetch(`${API_BASE}/session/${roomId}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json) => setData(json.data ?? json))
      .catch((e) => setErr(e.message));
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const s = io(API_BASE, { withCredentials: false, transports: ["websocket", "polling"] });
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true); setYouId(s.id);
      s.emit("join", { roomId, name: displayName });
    });
    s.on("disconnect", () => setConnected(false));
    s.on("room:error", ({ code }) => setErr(code || "room-error"));
    s.on("room:state", (p) => { if (p?.data) setData(p.data); if (p?.live?.claims) setClaims(normClaims(p.live.claims)); if (p?.live?.names) setNames(p.live.names); });
    s.on("room:live", (live) => { if (live?.claims) setClaims(normClaims(live.claims)); if (live?.names) setNames(live.names); });
    s.on("room:presence", (p) => { if (typeof p?.count === "number") setPresence(p.count); if (p?.live?.names) setNames(p.live.names); });

    return () => s.disconnect();
  }, [roomId, displayName]);

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
    if (ent.length === 1) { const [uid, q] = ent[0]; return uid !== youId && (Number(q) || 0) > 0; }
    return true;
  };

  const perUserTotals = useMemo(() => {
    try {
      const userBase = {}; let baseSum = 0;
      items.forEach((it, idx) => {
        const unit = getUnit(it);
        safeEntries(claims[idx] || {}).forEach(([uid, q]) => {
          const qty = Number(q) || 0;
          userBase[uid] = (userBase[uid] || 0) + unit * qty;
          baseSum += unit * qty;
        });
      });
      const subtotal = (subtotalPrinted != null)
        ? subtotalPrinted
        : items.reduce((a, it) => a + getUnit(it) * (Number(it.quantity ?? 1)), 0);
      const total = (totalPrinted != null) ? totalPrinted : subtotal;
      const fees = Math.max(0, +(total - subtotal).toFixed(3));

      const uids = Object.keys(userBase); const out = {};
      for (const uid of uids) {
        const base = userBase[uid];
        const feeShare = baseSum > 0 ? (fees * (base / baseSum)) : (uids.length ? fees / uids.length : 0);
        out[uid] = +(base + feeShare).toFixed(3);
      }
      return out;
    } catch { return {}; }
  }, [claims, items, subtotalPrinted, totalPrinted]);

  const yourTotal = youId && Number.isFinite(+perUserTotals[youId]) ? perUserTotals[youId] : 0;

  if (!roomId) return <div className="container"><div className="card"><h2>Missing room id</h2><Link to="/">← Back</Link></div></div>;
  if (err)      return <div className="container"><div className="card"><h2>Couldn’t load room {roomId}</h2><p className="helper">{err}</p><Link to="/">← Back</Link></div></div>;
  if (!data)    return <div className="container"><div className="card">Loading…</div></div>;

  const claimOne   = (idx) => connected && socketRef.current?.emit("room:claim",   { index: idx, qty: 1 }, (r)=>{ if(!r?.ok) console.warn("claim failed:", r?.error); });
  const unclaimOne = (idx) => connected && socketRef.current?.emit("room:unclaim", { index: idx, qty: 1 }, (r)=>{ if(!r?.ok) console.warn("unclaim failed:", r?.error); });

  const joinUrl = window.location.href;

  return (
    <>
      {/* App bar (optional) */}
      <div className="appbar">
        <div className="brand">
          <div className="badge">🧾</div>
          AIReceiptPro
        </div>
        <div className="pill"><span className="dot" /> {connected ? "Connected" : "Connecting…"}</div>
      </div>

      <div className="container">
        {/* Page header */}
        <div className="card" style={{paddingBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <h2 className="section-title" style={{marginBottom:6}}>Live room {roomId}</h2>
              <div className="helper">People online: <b>{presence || "-"}</b> • You are <b>{displayName}</b></div>
            </div>
            <Link to="/" className="btn sm ghost">← Back</Link>
          </div>
        </div>

        {/* Share row */}
        <div className="card" style={{marginTop:16}}>
          <div className="share">
            <div className="qr"><QRCodeCanvas value={joinUrl} size={128} includeMargin /></div>
            <div>
              <div className="helper" style={{marginBottom:6}}>Share this link</div>
              <div className="kbd" style={{wordBreak:"break-all"}}>{joinUrl}</div>
              <div style={{marginTop:10, display:"flex", gap:8}}>
                <button
                  className="btn primary sm"
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(joinUrl); alert("Link copied!"); }
                    catch { window.prompt("Copy link:", joinUrl); }
                  }}
                >Copy link</button>
              </div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="card" style={{marginTop:16}}>
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Unit</th>
                <th className="num">Line total</th>
                <th>Claims</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const unit = getUnit(it);
                const qty = Number(it.quantity ?? 1);
                const row = claims[idx] || {};
                const left = remaining(idx);
                const my   = mineQty(idx);
                const single = qty <= 1;
                const lockedByOther = takenByOtherSingle(idx);
                const canTake = connected && (single ? (!lockedByOther && left > 0) : left > 0);
                const canDrop = connected && my > 0;

                return (
                  <tr key={idx}>
                    <td>{it.name}</td>
                    <td className="num">{qty.toFixed(3)}</td>
                    <td className="num">{unit.toFixed(3)}</td>
                    <td className="num">{(unit * qty).toFixed(3)}</td>
                    <td>
                      <div className="helper">
                        {safeEntries(row).length === 0 && <span className="empty">—</span>}
                        {safeEntries(row).map(([uid, q]) => (
                          <div key={uid}><b>{names[uid] || uid}</b>: {Number(q).toFixed(3)}</div>
                        ))}
                        <div style={{marginTop:4}}>Remaining: <b>{left.toFixed(3)}</b></div>
                      </div>
                    </td>
                    <td className="num">
                      <div style={{display:"inline-flex", gap:8}}>
                        <button
                          className={`btn sm ${canTake ? "primary" : ""}`}
                          disabled={!canTake}
                          title={connected ? (single ? "Claim this item" : "Claim 1 unit") : "Connecting…"}
                          onClick={() => claimOne(idx)}
                        >{single ? "Claim" : "+1"}</button>
                        <button
                          className="btn sm ghost"
                          disabled={!canDrop}
                          title={connected ? (single ? "Release" : "Return 1 unit") : "Connecting…"}
                          onClick={() => unclaimOne(idx)}
                        >{single ? "Release" : "−1"}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="totals" style={{marginTop:16}}>
          <h3 style={{marginTop:0, marginBottom:10}}>Totals (incl. pro-rated fees/tax)</h3>
          {Object.keys(perUserTotals).length === 0 ? (
            <div className="empty">No selections yet.</div>
          ) : (
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
              {Object.entries(perUserTotals).map(([uid, amt]) => (
                <div className="row" key={uid}>
                  <span>{names[uid] || uid}{uid === youId ? " (you)" : ""}</span>
                  <b>{(Number(amt)||0).toFixed(3)}</b>
                </div>
              ))}
            </div>
          )}
          {youId && (
            <div className="helper" style={{marginTop:8}}>
              Your current total: <b>{(Number(yourTotal)||0).toFixed(3)}</b>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
