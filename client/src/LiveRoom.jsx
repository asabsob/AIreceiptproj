// src/LiveRoom.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { io } from "socket.io-client";

const isDev = import.meta.env.DEV;
const API_BASE = isDev
  ? import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
  : import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app";

function clamp(n, min, max) {
  const v = Number.isFinite(+n) ? +n : 0;
  return Math.min(Math.max(v, min), max);
}

export default function LiveRoom() {
  const { id: idFromParams } = useParams();
  const roomId =
    idFromParams || (window.location.hash.match(/\/live\/([^/?#]+)/)?.[1] ?? "");

  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState(1);
  const [err, setErr] = useState("");

  // immutable parsed receipt (from server)
  const [data, setData] = useState(null);
  // collaborative state (from server, patched by anyone)
  const [state, setState] = useState({
    people: ["Person 1", "Person 2"],
    mode: "itemized",
    assign: {},
    shares: {},
  });

  // connect once per roomId
  useEffect(() => {
    if (!roomId) return;
    const s = io(API_BASE, {
      transports: ["websocket", "polling"],
      withCredentials: false,
    });
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      setErr("");
      s.emit("join", { roomId });
    });

    s.on("disconnect", () => setConnected(false));

    s.on("room:error", ({ code }) => {
      setErr(code === "not_found" ? "Room not found (maybe expired)." : "Room error.");
    });

    s.on("room:presence", ({ count }) => setPresence(count || 1));

    s.on("room:state", (payload) => {
      // payload: { id, data, state, actor? }
      if (payload?.data) setData(payload.data);
      if (payload?.state) setState(payload.state);
    });

    return () => {
      s.disconnect();
    };
  }, [roomId]);

  const patch = useCallback((delta) => {
    socketRef.current?.emit("room:patch", delta);
  }, []);

  // ---- derived numbers (similar to Split.jsx) ----
  const feeDelta = useMemo(() => {
    const subtotalN = Number((data?.subtotal ?? 0) || 0);
    const totalN = Number((data?.total ?? subtotalN) || 0);
    const d = +(totalN - subtotalN).toFixed(3);
    return d > 0 ? d : 0;
  }, [data]);

  const evenShare = useMemo(() => {
    const totalN = Number(data?.total ?? 0);
    const subtotalN = Number(data?.subtotal ?? 0);
    const base = Math.max(totalN, subtotalN);
    const n = Math.max(state.people.length, 1);
    const per = +(base / n).toFixed(3);
    return Array(n).fill(per);
  }, [data, state.people.length]);

  const itemizedTotals = useMemo(() => {
    const n = state.people.length;
    const base = Array(n).fill(0);

    (data?.items ?? []).forEach((it, idx) => {
      const unit = Number(it.price) || 0;
      const qty = Number(it.quantity) || 0;
      const sArr = Array.isArray(state.shares[idx]) ? state.shares[idx] : null;
      const sumShares = sArr ? sArr.reduce((a, b) => a + (Number(b) || 0), 0) : 0;

      if (sArr && sumShares > 0) {
        for (let p = 0; p < n; p++) {
          const q = Number(sArr[p]) || 0;
          base[p] += unit * q;
        }
      } else {
        const owner = state.assign[idx];
        if (owner != null && owner >= 0 && owner < n) {
          base[owner] += unit * qty;
        }
      }
    });

    const sumBase = base.reduce((a, b) => a + b, 0);
    const adjusted = base.map((v) => {
      const share =
        sumBase > 0 ? feeDelta * (v / sumBase) : feeDelta / Math.max(n, 1);
      return +(v + share).toFixed(3);
    });

    return adjusted;
  }, [state.assign, state.shares, state.people.length, data, feeDelta]);

  // ---- UI actions (send patches) ----
  const setMode = (m) => {
    if (m !== "even" && m !== "itemized") return;
    patch({ mode: m });
  };

  const addPerson = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    patch({ people: [...state.people, trimmed] });
  };

  const removePerson = (idx) => {
    const next = state.people.filter((_, i) => i !== idx);
    // also prune assignments and shares
    const nextAssign = { ...state.assign };
    Object.keys(nextAssign).forEach((k) => {
      if (nextAssign[k] === idx) delete nextAssign[k];
      if (nextAssign[k] > idx) nextAssign[k] = nextAssign[k] - 1;
    });
    const nextShares = {};
    Object.keys(state.shares).forEach((k) => {
      const arr = state.shares[k] || [];
      nextShares[k] = arr.filter((_, i) => i !== idx);
    });
    patch({ people: next, assign: nextAssign, shares: nextShares });
  };

  const chooseOwner = (itemIdx, ownerIdxOrNull) => {
    const delta = {};
    delta[itemIdx] = ownerIdxOrNull;
    // clearing partial shares for that item if single-owner selected is handled on client:
    const nextShares = { ...state.shares };
    if (ownerIdxOrNull != null) delete nextShares[itemIdx];
    patch({ assign: delta, shares: nextShares });
  };

  const splitItemEvenly = (itemIdx, itemQty) => {
    const n = Math.max(state.people.length, 1);
    const per = +(itemQty / n);
    patch({
      shares: { ...state.shares, [itemIdx]: Array(n).fill(per) },
      assign: { ...state.assign, [itemIdx]: null },
    });
  };

  const clearItemSplit = (itemIdx) => {
    const nextShares = { ...state.shares };
    delete nextShares[itemIdx];
    const nextAssign = { ...state.assign };
    delete nextAssign[itemIdx];
    patch({ shares: nextShares, assign: nextAssign });
  };

  const setShareQty = (itemIdx, personIdx, value, itemQty) => {
    const v = clamp(value, 0, itemQty);
    const existing = Array.isArray(state.shares[itemIdx])
      ? [...state.shares[itemIdx]]
      : Array(state.people.length).fill(0);
    existing[personIdx] = v;

    // cap total to itemQty
    const sum = existing.reduce((a, b) => a + (Number(b) || 0), 0);
    if (sum > itemQty + 1e-9) {
      const over = sum - itemQty;
      const othersTotal = sum - v || 1e-9;
      for (let i = 0; i < existing.length; i++) {
        if (i === personIdx) continue;
        existing[i] = Math.max(0, existing[i] - over * (existing[i] / othersTotal));
      }
    }
    // switching to partial clears single-owner
    const nextAssign = { ...state.assign };
    delete nextAssign[itemIdx];

    patch({ shares: { ...state.shares, [itemIdx]: existing }, assign: nextAssign });
  };

  if (!roomId) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <h2>Missing room id</h2>
        <p>Use a link like <code>#/live/ABC123</code>.</p>
        <Link to="/">← Back</Link>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#b00020" }}>
        <h2>Couldn’t load room {roomId}</h2>
        <p>Error: {err}</p>
        <p>This room may have expired after a backend restart. Ask the creator to share a fresh link.</p>
        <Link to="/">← Back</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        Connecting… {connected ? "" : "(offline)"} 
      </div>
    );
  }

  const items = data.items ?? [];
  const lineTotal = (it) => (Number(it.price) || 0) * (Number(it.quantity) || 1);

  // --- UI ---
  const [newPerson, setNewPerson] = useState("");

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Live Room {roomId}</h1>
        <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
          <span style={{ fontSize: 13, color: "#666" }}>
            {connected ? "●" : "○"} {presence} online
          </span>
          <Link to="/" style={{ fontSize: 14 }}>← Back</Link>
        </div>
      </div>

      <div style={{ marginTop: 8, color: "#666" }}>
        Subtotal: <b>{Number(data.subtotal || 0).toFixed(3)}</b> &nbsp;•&nbsp;
        Tax/Fees: <b>{(+((data.total ?? 0) - (data.subtotal ?? 0))).toFixed(3)}</b> &nbsp;•&nbsp;
        Total: <b>{Number(data.total || 0).toFixed(3)}</b>
      </div>

      {/* Mode toggle */}
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          onClick={() => setMode("even")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: state.mode === "even" ? "#f2f2f2" : "white",
            cursor: "pointer",
          }}
        >
          Even split
        </button>
        <button
          onClick={() => setMode("itemized")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: state.mode === "itemized" ? "#f2f2f2" : "white",
            cursor: "pointer",
          }}
        >
          Select / partial split
        </button>
      </div>

      {/* People */}
      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>People</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {state.people.map((p, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #eee", borderRadius: 8, padding: "4px 8px" }}>
              <span>{p}</span>
              {state.people.length > 1 && (
                <button
                  onClick={() => removePerson(idx)}
                  style={{ border: "1px solid #ddd", borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}
                  title="Remove person"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <input
            value={newPerson}
            placeholder="Add person (e.g., Omar)"
            onChange={(e) => setNewPerson(e.target.value)}
            style={{ flex: "0 1 260px", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
          />
          <button
            onClick={() => { addPerson(newPerson); setNewPerson(""); }}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Modes */}
      {state.mode === "even" && (
        <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Even split</h3>
          <TotalsBlock people={state.people} values={evenShare} />
        </div>
      )}

      {state.mode === "itemized" && (
        <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Assign items / Partial split (live)</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Item</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Qty</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Price</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Line Total</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Assign / Split</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const qty = Number(it.quantity) || 0;
                const sArr = Array.isArray(state.shares[idx])
                  ? state.shares[idx]
                  : Array(state.people.length).fill(0);
                const sumShares = sArr.reduce((a, b) => a + (Number(b) || 0), 0);
                const remaining = Math.max(0, qty - sumShares);
                return (
                  <tr key={idx}>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>{it.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                      {qty.toFixed(3)}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                      {Number(it.price).toFixed(3)}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                      {(lineTotal(it)).toFixed(3)}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                          value={state.assign[idx] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : Number(e.target.value);
                            chooseOwner(idx, val);
                          }}
                          style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px" }}
                        >
                          <option value="">— Single owner —</option>
                          {state.people.map((p, pIdx) => (
                            <option key={pIdx} value={pIdx}>{p}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => splitItemEvenly(idx, qty)}
                          style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer" }}
                        >
                          Split evenly
                        </button>

                        <button
                          onClick={() => clearItemSplit(idx)}
                          style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer" }}
                        >
                          Clear
                        </button>
                      </div>

                      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                        {state.people.map((p, pIdx) => (
                          <div key={pIdx} style={{ display: "flex", flexDirection: "column" }}>
                            <label style={{ fontSize: 12, color: "#555" }}>{p}</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={String(sArr[pIdx] ?? 0)}
                              onChange={(e) => setShareQty(idx, pIdx, e.target.value, qty)}
                              onFocus={() => {
                                // entering partial mode removes single-owner for this item
                                const nextAssign = { ...state.assign };
                                delete nextAssign[idx];
                                patch({ assign: nextAssign });
                              }}
                              style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px" }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: remaining === 0 ? "#2e7d32" : "#b00020" }}>
                        {remaining.toFixed(3)} qty remaining to allocate
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <h4 style={{ marginTop: 0 }}>Totals (incl. tax/fees)</h4>
            <TotalsBlock people={state.people} values={itemizedTotals} />
          </div>
        </div>
      )}
    </div>
  );
}

function TotalsBlock({ people, values }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 520, gap: 8 }}>
      {people.map((p, idx) => (
        <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderBottom: "1px dashed #eee" }}>
          <span>{p}</span>
          <b>{(values[idx] ?? 0).toFixed(3)}</b>
        </div>
      ))}
    </div>
  );
}
