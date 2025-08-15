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
  const [data, setData] = useState(null);      // immutable {items, subtotal, tax, total}
  const [claims, setClaims] = useState([]);    // array of { userId: qty, ... }
  const [names, setNames] = useState({});      // { userId: name }
  const [presence, setPresence] = useState(0);
  const socketRef = useRef(null);

  // who am I (for showing "you" in the UI)
  const [displayName] = useState(() => {
    const saved = localStorage.getItem("displayName");
    if (saved) return saved;
    const n = "Guest-" + Math.random().toString(36).slice(2,6);
    localStorage.setItem("displayName", n);
    return n;
  });

  useEffect(() => {
    if (!roomId) return;

    // Get static room payload first (items etc.)
    fetch(`${API_BASE}/session/${roomId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(json => {
        setData(json.data ?? json); // support {id,data} or flat
      })
      .catch(e => setErr(e.message));
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    // connect socket
    const s = io(API_BASE, { transports: ["websocket"], withCredentials: false });
    socketRef.current = s;

    s.on("connect", () => {
      s.emit("join", { roomId, name: displayName });
    });

    s.on("room:error", ({ code }) => setErr(code || "room-error"));
    s.on("room:state", (payload) => {
      // first state: immutable + live
      if (payload?.data) setData(payload.data);
      if (payload?.live?.claims) setClaims(payload.live.claims);
      if (payload?.live?.names) setNames(payload.live.names);
    });
    s.on("room:live", (live) => {
      if (live?.claims) setClaims(live.claims);
      if (live?.names) setNames(live.names);
    });
    s.on("room:presence", (p) => {
      if (typeof p?.count === "number") setPresence(p.count);
      if (p?.live?.names) setNames(p.live.names);
    });
    s.on("toast", (t) => {
      if (t?.message) console.warn("Server:", t.message);
    });

    s.on("disconnect", () => {});
    return () => { s.disconnect(); };
  }, [roomId, displayName]);

  if (!roomId) {
    return (
      <div style={{ padding:16, fontFamily: "system-ui,sans-serif" }}>
        <h2>Missing room id</h2>
        <p>Use a link like <code>#/live/ABC123</code>.</p>
        <Link to="/">← Back</Link>
      </div>
    );
  }
  if (err) {
    return (
      <div style={{ padding:16, fontFamily: "system-ui,sans-serif", color:"#b00020" }}>
        <h2>Couldn’t load room {roomId}</h2>
        <p>Error: {err}</p>
        <Link to="/">← Back</Link>
      </div>
    );
  }
  if (!data) {
    return <div style={{ padding:16, fontFamily: "system-ui,sans-serif" }}>Loading…</div>;
  }

  const items = data.items ?? [];
  const youId = useMemo(() => {
    // best-effort: find the userId by display name (names map values are unique per session)
    const entry = Object.entries(names).find(([_, n]) => n === displayName);
    return entry?.[0] || null;
  }, [names, displayName]);

  const sumClaims = (idx) => {
    const row = claims[idx] || {};
    return Object.values(row).reduce((a, b) => a + (Number(b)||0), 0);
  };
  const remaining = (idx) => {
    const q = Number(items[idx]?.quantity ?? 0) || 0;
    return Math.max(0, q - sumClaims(idx));
  };
  const mineQty = (idx) => {
    if (!youId) return 0;
    const row = claims[idx] || {};
    return Number(row[youId] || 0);
  };

  const claimOne = (idx) => {
    socketRef.current?.emit("room:claim", { index: idx, qty: 1 }, (res) => {
      if (!res?.ok) console.warn("claim failed:", res?.error);
    });
  };
  const unclaimOne = (idx) => {
    socketRef.current?.emit("room:unclaim", { index: idx, qty: 1 }, (res) => {
      if (!res?.ok) console.warn("unclaim failed:", res?.error);
    });
  };

  const joinUrl = window.location.href;

  return (
    <div style={{ padding:16, fontFamily: "system-ui,sans-serif", maxWidth: 1000, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
        <div>
          <h2 style={{ margin:0 }}>Live room {roomId}</h2>
          <div style={{ color:"#666", fontSize:13 }}>
            People online: <b>{presence || "-"}</b>
          </div>
        </div>
        <Link to="/" style={{ fontSize:14 }}>← Back</Link>
      </div>

      <div style={{ marginTop:12, display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
        <QRCodeCanvas value={joinUrl} size={140} includeMargin />
        <div style={{ fontSize:13, wordBreak:"break-all" }}>
          <div style={{ color:"#555", marginBottom:6 }}>Share this link:</div>
          <code>{joinUrl}</code>
          <div style={{ marginTop:8, display:"flex", gap:8 }}>
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(joinUrl); alert("Link copied!"); }
                catch { window.prompt("Copy link:", joinUrl); }
              }}
              style={{ padding:"6px 10px", border:"1px solid #ddd", borderRadius:8, cursor:"pointer" }}
            >
              Copy link
            </button>
          </div>
        </div>
      </div>

      <table style={{ width:"100%", borderCollapse:"collapse", marginTop:16 }}>
        <thead>
          <tr>
            <th style={{ textAlign:"left", borderBottom:"1px solid #ddd", padding:8 }}>Item</th>
            <th style={{ textAlign:"right", borderBottom:"1px solid #ddd", padding:8 }}>Qty</th>
            <th style={{ textAlign:"right", borderBottom:"1px solid #ddd", padding:8 }}>Price</th>
            <th style={{ textAlign:"left",  borderBottom:"1px solid #ddd", padding:8 }}>Claims</th>
            <th style={{ textAlign:"right", borderBottom:"1px solid #ddd", padding:8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const row = claims[idx] || {};
            const left = remaining(idx);
            const my = mineQty(idx);
            const canTake = left > 0;
            const canDrop = my > 0;

            return (
              <tr key={idx}>
                <td style={{ padding:8, borderBottom:"1px solid #f1f1f1" }}>{it.name}</td>
                <td style={{ padding:8, borderBottom:"1px solid #f1f1f1", textAlign:"right" }}>
                  {Number(it.quantity ?? 1).toFixed(3)}
                </td>
                <td style={{ padding:8, borderBottom:"1px solid #f1f1f1", textAlign:"right" }}>
                  {Number(it.price ?? 0).toFixed(3)}
                </td>
                <td style={{ padding:8, borderBottom:"1px solid #f1f1f1" }}>
                  <div style={{ fontSize:13 }}>
                    {Object.entries(row).length === 0 && <span style={{ color:"#777" }}>—</span>}
                    {Object.entries(row).map(([uid, q]) => (
                      <div key={uid}>
                        <b>{names[uid] || uid}</b>: {Number(q).toFixed(3)}
                      </div>
                    ))}
                    <div style={{ marginTop:4, color: left === 0 ? "#2e7d32" : "#b06a00" }}>
                      Remaining: <b>{left.toFixed(3)}</b>
                    </div>
                  </div>
                </td>
                <td style={{ padding:8, borderBottom:"1px solid #f1f1f1", textAlign:"right" }}>
                  <div style={{ display:"inline-flex", gap:8 }}>
                    <button
                      onClick={() => claimOne(idx)}
                      disabled={!canTake}
                      title={canTake ? "Claim 1 unit" : "No units left"}
                      style={{
                        padding:"6px 10px",
                        border:"1px solid #ddd",
                        borderRadius:8,
                        cursor: canTake ? "pointer" : "not-allowed",
                        background: canTake ? "#111" : "#eee",
                        color: canTake ? "#fff" : "#999",
                      }}
                    >Take 1</button>
                    <button
                      onClick={() => unclaimOne(idx)}
                      disabled={!canDrop}
                      title={canDrop ? "Release 1 unit" : "You have none"}
                      style={{
                        padding:"6px 10px",
                        border:"1px solid #ddd",
                        borderRadius:8,
                        cursor: canDrop ? "pointer" : "not-allowed",
                        background: "white",
                      }}
                    >Put back</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
