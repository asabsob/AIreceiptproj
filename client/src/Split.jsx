import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

function parseHashData() {
  try {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const enc = params.get("data");
    if (!enc) return null;
    const jsonStr = atob(decodeURIComponent(enc));
    const parsed = JSON.parse(jsonStr);
    // normalize
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const normalized = items.map((it) => ({
      name: String(it.name ?? "").trim(),
      quantity: Number(it.quantity ?? 1) || 1,
      price: Number(it.price ?? 0) || 0,
    }));
    const subtotal =
      parsed.subtotal ??
      normalized.reduce((a, it) => a + it.price * it.quantity, 0);
    const tax = parsed.tax ?? null;
    const total =
      parsed.total ?? (tax != null ? subtotal + Number(tax) : subtotal);
    return { items: normalized, subtotal, tax, total };
  } catch {
    return null;
  }
}

export default function Split() {
  const data = useMemo(parseHashData, []);
  const [mode, setMode] = useState("even"); // "even" | "itemized"
  const [people, setPeople] = useState(["Person 1", "Person 2"]);
  const [newPerson, setNewPerson] = useState("");
  const [assign, setAssign] = useState({}); // {itemIndex: personIndex}

  useEffect(() => {
    // reset assignments if people change
    setAssign((old) => {
      const next = { ...old };
      Object.keys(next).forEach((k) => {
        if (next[k] >= people.length) delete next[k];
      });
      return next;
    });
  }, [people.length]);

  if (!data) {
    return (
      <div style={{ maxWidth: 920, margin: "40px auto", padding: 16 }}>
        <h1>Split Receipt</h1>
        <p style={{ color: "#b00020" }}>
          No receipt data found in the URL. Go back and parse a receipt first.
        </p>
        <Link to="/">← Back</Link>
      </div>
    );
  }

  const lineTotal = (it) =>
    (Number(it.price) || 0) * (Number(it.quantity) || 1);

  // Itemized totals per person
  const itemizedTotals = useMemo(() => {
    const totals = Array(people.length).fill(0);
    data.items.forEach((it, idx) => {
      const p = assign[idx];
      if (p != null && p >= 0 && p < people.length) {
        totals[p] += lineTotal(it);
      }
    });
    return totals.map((v) => +v.toFixed(3));
  }, [assign, data.items, people.length]);

  const evenShare = useMemo(() => {
    const base = Number(data.total ?? 0);
    const n = Math.max(people.length, 1);
    const per = +(base / n).toFixed(3);
    return Array(n).fill(per);
  }, [data.total, people.length]);

  const addPerson = () => {
    const name = newPerson.trim();
    setNewPerson("");
    if (!name) return;
    setPeople((p) => [...p, name]);
  };

  const removePerson = (idx) => {
    setPeople((p) => p.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Split Receipt</h1>
        <Link to="/" style={{ fontSize: 14 }}>← Back to Upload</Link>
      </div>

      <div style={{ marginTop: 8, color: "#666" }}>
        Subtotal: <b>{Number(data.subtotal || 0).toFixed(3)}</b> &nbsp;•&nbsp; 
        Tax: <b>{data.tax != null ? Number(data.tax).toFixed(3) : "-"}</b> &nbsp;•&nbsp; 
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
            background: mode === "even" ? "#f2f2f2" : "white",
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
            background: mode === "itemized" ? "#f2f2f2" : "white",
            cursor: "pointer",
          }}
        >
          Select items
        </button>
      </div>

      {/* People manager */}
      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>People</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {people.map((p, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #eee", borderRadius: 8, padding: "4px 8px" }}>
              <span>{p}</span>
              {people.length > 1 && (
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
            placeholder={`Add person (e.g., Omar)`}
            onChange={(e) => setNewPerson(e.target.value)}
            style={{ flex: "0 1 260px", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
          />
          <button onClick={addPerson} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer" }}>
            Add
          </button>
        </div>
      </div>

      {/* Mode views */}
      {mode === "even" && (
        <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Even split</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 520, gap: 8 }}>
            {people.map((p, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderBottom: "1px dashed #eee" }}>
                <span>{p}</span>
                <b>{evenShare[idx].toFixed(3)}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "itemized" && (
        <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Assign items</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Item</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Qty</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Price</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Line Total</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Assign to</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>{it.name}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>{it.quantity}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>{Number(it.price).toFixed(3)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1", textAlign: "right" }}>{lineTotal(it).toFixed(3)}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f1f1" }}>
                    <select
                      value={assign[idx] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : Number(e.target.value);
                        setAssign((a) => ({ ...a, [idx]: val }));
                      }}
                      style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px" }}
                    >
                      <option value="">— Unassigned —</option>
                      {people.map((p, pIdx) => (
                        <option key={pIdx} value={pIdx}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <h4 style={{ marginTop: 0 }}>Totals</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: 520, gap: 8 }}>
              {people.map((p, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderBottom: "1px dashed #eee" }}>
                  <span>{p}</span>
                  <b>{itemizedTotals[idx].toFixed(3)}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
