import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { io } from "socket.io-client";

const isDev = import.meta.env.DEV;
const API_BASE = isDev
  ? import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
  : import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app";

// ------- small helpers -------
const clamp = (n, min, max) => Math.min(Math.max(+n || 0, min), max);
const lineTotal = (it) => (Number(it.price) || 0) * (Number(it.quantity) || 1);

export default function Room() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null); // {id, items[], subtotal, tax, total}
  const [people, setPeople] = useState(["Person 1", "Person 2"]);
  const [newPerson, setNewPerson] = useState("");

  // split state
  const [assign, setAssign] = useState({}); // { itemIdx: personIdx }
  const [shares, setShares] = useState({}); // { itemIdx: number[] } quantities per person

  // socket (optional, degrades gracefully)
  const socketRef = useRef(null);
  const connected = !!socketRef.current && socketRef.current.connected;

  // fetch session data
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setErr("");
    fetch(`${API_BASE}/session/${id}`, { headers: { Accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const flat = {
          id: json.id,
          items: json.items ?? json.data?.items ?? [],
          subtotal: json.subtotal ?? json.data?.subtotal ?? null,
          tax: json.tax ?? json.data?.tax ?? null,
          total: json.total ?? json.data?.total ?? null
        };
        setData(flat);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // keep shares length in sync with people
  useEffect(() => {
    setShares((old) => {
      const next = { ...old };
      for (const k of Object.keys(next)) {
        const arr = Array.isArray(next[k]) ? next[k] : [];
        if (arr.length !== people.length) {
          const resized = Array(people.length).fill(0);
          for (let i = 0; i < Math.min(arr.length, resized.length); i++) resized[i] = arr[i];
          next[k] = resized;
        }
      }
      return next;
    });
    setAssign((old) => {
      const n = people.length;
      const next = { ...old };
      for (const k of Object.keys(next)) if (next[k] == null || next[k] >= n) delete next[k];
      return next;
    });
  }, [people.length]);

  // join realtime room if server supports it
  useEffect(() => {
    if (!id) return;
    try {
      const s = io(API_BASE, { transports: ["websocket"] });
      socketRef.current = s;

      s.on("connect", () => {
        s.emit("join", { roomId: id });
        // request initial state (if backend stores it)
        s.emit("state:get", { roomId: id });
      });

      s.on("state:init", (payload) => {
        // expected shape: { people, assign, shares }
        if (payload?.people) setPeople(payload.people);
        if (payload?.assign) setAssign(payload.assign);
        if (payload?.shares) setShares(payload.shares);
      });

      s.on("state:patch", (patch) => {
        if (patch?.people) setPeople(patch.people);
        if (patch?.assign) setAssign(patch.assign);
        if (patch?.shares) setShares(patch.shares);
      });

      return () => s.disconnect();
    } catch {
      // ignore; page still works without realtime
    }
  }, [id]);

  const sendPatch = (patch) => {
    try {
      socketRef.current?.emit("state:patch", { roomId: id, ...patch });
    } catch {}
  };

  const roomUrl = `${window.location.origin}/#/room/${id}`;

  // numbers
  const fees = useMemo(() => {
    if (!data) return 0;
    const subtotalN = Number(data.subtotal ?? 0);
    const totalN = Number(data.total ?? subtotalN);
    const delta = +(totalN - subtotalN).toFixed(3);
    return delta > 0 ? delta : 0;
  }, [data]);

  const itemizedTotals = useMemo(() => {
    if (!data) return [];
    const n = people.length;
    const base = Array(n).fill(0);

    data.items.forEach((it, idx) => {
      const unit = Number(it.price) || 0;
      const qty = Number(it.quantity) || 0;
      const sArr = Array.isArray(shares[idx]) ? shares[idx] : null;
      const sumShares = sArr ? sArr.reduce((a, b) => a + (Number(b) || 0), 0) : 0;

      if (sArr && sumShares > 0) {
        for (let p = 0; p < n; p++) base[p] += unit * (Number(sArr[p]) || 0);
      } else {
        const owner = assign[idx];
        if (owner != null && owner >= 0 && owner < n) base[owner] += unit * qty;
      }
    });

    const sumBase = base.reduce((a, b) => a + b, 0);
    const adjusted = base.map((v) => {
      const share = sumBase > 0 ? fees * (v / sumBase) : fees / Math.max(n, 1);
      return +(v + share).toFixed(3);
    });

    return adjusted;
  }, [assign, shares, data, fees, people.length]);

  // UI actions
  const addPerson = () => {
    const name = newPerson.trim();
    setNewPerson("");
    if (!name) return;
    const next = [...people, name];
    setPeople(next);
    sendPatch({ people: next });
  };
  const removePerson = (idx) => {
    const next = people.filter((_, i) => i !== idx);
    setPeople(next);
    sendPatch({ people: next });
  };
  const setShareQty = (itemIdx, personIdx, value, itemQty) => {
    const v = clamp(value, 0, itemQty);
    setShares((prev) => {
      const arr = Array.isArray(prev[itemIdx]) ? [...prev[itemIdx]] : Array(people.length).fill(0);
      arr[personIdx] = v;
      // cap to itemQty
      const sum = arr.reduce((a, b) => a + (Number(b) || 0), 0);
      if (sum > itemQty + 1e-9) {
        const over = sum - itemQty;
        const othersTotal = sum - v || 1e-9;
        for (let i = 0; i < arr.length; i++) if (i !== personIdx) {
          arr[i] = Math.max(0, arr[i] - (over * (arr[i] / othersTotal)));
        }
      }
      const next = { ...prev, [itemIdx]: arr };
      sendPatch({ shares: next });
      return next;
    });
  };
  const evenSplitItem = (itemIdx, itemQty) => {
    const n = Math.max(people.length, 1);
    const per = +(itemQty / n);
    setShares((prev) => {
      const next = { ...prev, [itemIdx]: Array(n).fill(per) };
      sendPatch({ shares: next });
      return next;
    });
    setAssign((a) => {
      const nA = { ...a }; delete nA[itemIdx];
      sendPatch({ assign: nA });
      return nA;
    });
  };
  const clearItemSplit = (itemIdx) => {
    setShares((prev) => {
      const n = { ...prev }; delete n[itemIdx];
      sendPatch({ shares: n });
      return n;
    });
    setAssign((a) => {
      const n = { ...a }; delete n[itemIdx];
      sendPatch({ assign: n });
      return n;
    });
  };

  if (!id) {
    return (
      <div>
        <h2>Missing room id</h2>
        <p>Use <code>#/room/XXXXXX</code>.</p>
        <Link to="/">← Back</Link>
      </div>
    );
  }
  if (loading) return <div>Loading…</div>;
  if (err) return <div className="warn">Error: {err} <div><Link to="/">← Back</Link></div></div>;
  if (!data) return null;

  const { items, subtotal, tax, total } = data;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Room {data.id} <span className="ok" style={{ fontSize: 14 }}>{connected ? "• live" : "• offline"}</span></h2>
        </div>
        <Link to="/" style={{ fontSize: 14 }}>← Back</Link>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <QRCodeCanvas value={roomUrl} size={140} includeMargin />
        <div style={{ maxWidth: 500 }}>
          <div className="muted" style={{ marginBottom: 6 }}>Invite link:</div>
          <code>{roomUrl}</code>
        </div>
      </div>

      <div className="hr"></div>

      <div className="muted" style={{ marginBottom: 8 }}>
        Subtotal: <b>{Number(subtotal ?? 0).toFixed(3)}</b> &nbsp;•&nbsp;
        Tax: <b>{tax != null ? Number(tax).toFixed(3) : "-"}</b> &nbsp;•&nbsp;
        Fees: <b>{fees.toFixed(3)}</b> &nbsp;•&nbsp;
        Total: <b>{Number(total ?? subtotal ?? 0).toFixed(3)}</b>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ textAlign: "right" }}>Qty</th>
              <th style={{ textAlign: "right" }}>Price</th>
              <th style={{ textAlign: "right" }}>Line total</th>
              <th>Assign / Split</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const sArr = Array.isArray(shares[idx]) ? shares[idx] : Array(people.length).fill(0);
              const sumShares = sArr.reduce((a, b) => a + (Number(b) || 0), 0);
              const remaining = Math.max(0, Number(it.quantity) - sumShares);
              return (
                <tr key={idx}>
                  <td>{it.name}</td>
                  <td style={{ textAlign: "right" }}>{Number(it.quantity ?? 1).toFixed(3)}</td>
                  <td style={{ textAlign: "right" }}>{Number(it.price ?? 0).toFixed(3)}</td>
                  <td style={{ textAlign: "right" }}>{lineTotal(it).toFixed(3)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <select
                        value={assign[idx] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? null : Number(e.target.value);
                          setAssign((a) => {
                            const next = { ...a, [idx]: val };
                            sendPatch({ assign: next });
                            return next;
                          });
                          if (val != null) {
                            setShares((prev) => {
                              const n = { ...prev }; delete n[idx];
                              sendPatch({ shares: n });
                              return n;
                            });
                          }
                        }}
                        className="btn"
                        style={{ padding: "6px 8px" }}
                      >
                        <option value="">— Single owner —</option>
                        {people.map((p, pIdx) => <option key={pIdx} value={pIdx}>{p}</option>)}
                      </select>
                      <button className="btn" onClick={() => evenSplitItem(idx, Number(it.quantity))}>Split evenly</button>
                      <button className="btn" onClick={() => clearItemSplit(idx)}>Clear</button>
                    </div>

                    <div style={{ marginTop: 8 }} className="grid4">
                      {people.map((p, pIdx) => (
                        <div key={pIdx} style={{ display: "flex", flexDirection: "column" }}>
                          <label className="muted" style={{ fontSize: 12 }}>{p}</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={String(sArr[pIdx] ?? 0)}
                            onFocus={() => {
                              setAssign((a) => {
                                const n = { ...a }; delete n[idx];
                                sendPatch({ assign: n });
                                return n;
                              });
                            }}
                            onChange={(e) => setShareQty(idx, pIdx, e.target.value, Number(it.quantity))}
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
      </div>

      {/* People & totals */}
      <div className="row" style={{ marginTop: 16 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>People</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {people.map((p, idx) => (
              <span key={idx} className="pill">
                {p}
                {people.length > 1 && (
                  <button
                    onClick={() => removePerson(idx)}
                    className="btn"
                    style={{ border: "none", padding: "0 6px", marginLeft: 6 }}
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <input
              placeholder="Add person (e.g., Omar)"
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px", flex: "0 1 260px" }}
            />
            <button className="btn" onClick={addPerson}>Add</button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Totals (incl. proportional fees)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 480, gap: 8 }}>
            {people.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #eee", padding: "6px 8px" }}>
                <span>{p}</span>
                <b>{(itemizedTotals[i] ?? 0).toFixed(3)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
