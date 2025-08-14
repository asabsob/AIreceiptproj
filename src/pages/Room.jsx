import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";

const isDev = import.meta.env.DEV;
const API_BASE = isDev
  ? (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000")
  : (import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app");

export default function Room() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;
    setErr(""); setData(null);
    fetch(`${API_BASE}/session/${id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => setData(json))
      .catch(e => setErr(e.message));
  }, [id]);

  const items = data?.items ?? data?.data?.items ?? [];
  const subtotal = data?.subtotal ?? data?.data?.subtotal ?? null;
  const tax = data?.tax ?? data?.data?.tax ?? null;
  const total = data?.total ?? data?.data?.total ?? null;

  const [people, setPeople] = useState(["Person 1", "Person 2"]);
  const [assign, setAssign] = useState({}); // { itemIndex: personIndex }

  const totals = useMemo(() => {
    const n = people.length;
    const base = Array(n).fill(0);
    items.forEach((it, idx) => {
      const owner = assign[idx];
      const line = (Number(it.price)||0) * (Number(it.quantity)||1);
      if (owner != null && owner >= 0 && owner < n) base[owner] += line;
    });
    const baseSum = base.reduce((a,b)=>a+b,0);
    const fees = Math.max(0, (Number(total ?? subtotal ?? 0) - Number(subtotal ?? 0)));
    const adjusted = base.map(v => +(v + (baseSum>0 ? fees * (v/baseSum) : 0)).toFixed(3));
    return adjusted;
  }, [assign, items, people.length, subtotal, total]);

  if (!id) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
        <h2>Missing room id</h2>
        <Link to="/">← Back</Link>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#b00020" }}>
        <h2>Couldn’t load room {id}</h2>
        <p>{err}</p>
        <Link to="/">← Back</Link>
      </div>
    );
  }

  if (!data) return <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>Loading…</div>;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>Room {data.id}</h2>
        <Link to="/" style={{ fontSize: 14 }}>← Back</Link>
      </div>

      <div style={{ marginTop: 6, color: "#666" }}>
        Subtotal: <b>{Number(subtotal ?? 0).toFixed(3)}</b> •
        Tax/Fees: <b>{Number((total ?? 0) - (subtotal ?? 0)).toFixed(3)}</b> •
        Total: <b>{Number(total ?? subtotal ?? 0).toFixed(3)}</b>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>People</h3>
        <PeopleEditor people={people} setPeople={setPeople}/>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Assign items</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Item</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Qty</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Price</th>
              <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Line</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Owner</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>{it.name}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>{Number(it.quantity||1).toFixed(3)}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>{Number(it.price||0).toFixed(3)}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>
                  {((Number(it.price)||0) * (Number(it.quantity)||1)).toFixed(3)}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>
                  <select
                    value={assign[idx] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      setAssign(a => ({ ...a, [idx]: v }));
                    }}
                    style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px" }}
                  >
                    <option value="">— Unassigned —</option>
                    {people.map((p, pIdx) => (
                      <option key={pIdx} value={pIdx}>{p}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginTop: 0 }}>Totals per person (incl. fees)</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 520, gap: 8 }}>
            {people.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed #eee", padding: "6px 8px" }}>
                <span>{p}</span>
                <b>{(totals[i] ?? 0).toFixed(3)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PeopleEditor({ people, setPeople }) {
  const [name, setName] = useState("");
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {people.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #eee", borderRadius: 8, padding: "4px 8px" }}>
            <span>{p}</span>
            {people.length > 1 && (
              <button onClick={() => setPeople(arr => arr.filter((_, idx) => idx !== i))}
                style={{ border: "1px solid #ddd", borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <input
          value={name}
          placeholder="Add person (e.g., Omar)"
          onChange={(e) => setName(e.target.value)}
          style={{ flex: "0 1 260px", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
        />
        <button
          onClick={() => { const n = name.trim(); if (!n) return; setPeople(p => [...p, n]); setName(""); }}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}
        >
          Add
        </button>
      </div>
    </>
  );
}
