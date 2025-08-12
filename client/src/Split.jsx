import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

// --- helpers ---
function useReceiptData() {
  const { search } = useLocation(); // HashRouter puts ?... after #
  return useMemo(() => {
    try {
      const enc = new URLSearchParams(search).get("data");
      if (!enc) return null;
      const jsonStr = atob(decodeURIComponent(enc));
      const parsed = JSON.parse(jsonStr);

      // 1) Base normalize
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      let normalized = items.map((it) => ({
        name: String(it?.name ?? "").trim(),
        quantity: Math.max(1e-9, Number(it?.quantity ?? 1) || 1),
        price: Number(it?.price ?? it?.unit_price ?? 0) || 0, // may be unit OR line total
      }));

      const printedSubtotal = Number(parsed.subtotal ?? 0) || null;
      const printedTax = parsed.tax != null ? Number(parsed.tax) : null;
      const printedTotal =
        parsed.total != null ? Number(parsed.total) : null;

      // 2) Detect if price is line total, not unit: compare sums
      const sumUnitGuess = normalized.reduce(
        (a, it) => a + (Number(it.price) || 0) * (Number(it.quantity) || 1),
        0
      );
      const sumAsLines = normalized.reduce(
        (a, it) => a + (Number(it.price) || 0),
        0
      );

      let targetBase =
        printedSubtotal ??
        (printedTotal != null && printedTax != null
          ? printedTotal - printedTax
          : null);

      // If printed subtotal exists, prefer it as truth
      if (targetBase != null) {
        const diffUnit = Math.abs(sumUnitGuess - targetBase);
        const diffLines = Math.abs(sumAsLines - targetBase);
        // If prices look like line totals, convert to unit prices
        if (diffLines + 1e-6 < diffUnit) {
          normalized = normalized.map((it) => ({
            ...it,
            price: (Number(it.price) || 0) / (Number(it.quantity) || 1),
          }));
        }
      } else {
        // No printed subtotal; if quantities>1 exist and prices look like lines, convert anyway
        if (sumAsLines > 0 && sumAsLines + 1e-6 < sumUnitGuess) {
          normalized = normalized.map((it) => ({
            ...it,
            price: (Number(it.price) || 0) / (Number(it.quantity) || 1),
          }));
        }
      }

      // 3) Recompute base and softly scale to match printed subtotal/total
      let computedBase = normalized.reduce(
        (a, it) => a + (Number(it.price) || 0) * (Number(it.quantity) || 1),
        0
      );
      if (targetBase == null && printedTotal != null) {
        // derive target base from total if tax known or zero
        targetBase =
          printedTax != null ? printedTotal - printedTax : printedTotal;
      }
      if (targetBase != null && computedBase > 0) {
        const ratio = targetBase / computedBase;
        // Only scale if off by more than ~2%
        if (Math.abs(1 - ratio) > 0.02) {
          normalized = normalized.map((it) => ({
            ...it,
            price: +(Number(it.price) * ratio).toFixed(6), // keep precision, round later
          }));
          computedBase = normalized.reduce(
            (a, x) => a + x.price * x.quantity,
            0
          );
        }
      }

      // 4) Final numbers (3-decimals like JOD)
      const subtotal =
        printedSubtotal != null ? +printedSubtotal : +computedBase.toFixed(3);
      let tax =
        printedTax != null
          ? +printedTax
          : printedTotal != null
          ? +(printedTotal - subtotal).toFixed(3)
          : null;
      let total =
        printedTotal != null
          ? +printedTotal
          : +(subtotal + (tax || 0)).toFixed(3);

      // Round unit prices to 3dp for display; keep sums consistent
      const rounded = normalized.map((it) => ({
        ...it,
        price: +Number(it.price).toFixed(3),
      }));

      return { items: rounded, subtotal, tax, total };
    } catch {
      return null;
    }
  }, [search]);
}

function clamp(n, min, max) {
  const v = Number.isFinite(+n) ? +n : 0;
  return Math.min(Math.max(v, min), max);
}

export default function Split() {
  const data = useReceiptData();
  const [mode, setMode] = useState("itemized"); // default to itemized for partials
  const [people, setPeople] = useState(["Person 1", "Person 2"]);
  const [newPerson, setNewPerson] = useState("");
  const [assign, setAssign] = useState({}); // { itemIndex: personIndex }  (single owner)
  const [shares, setShares] = useState({}); // { itemIndex: number[] }     (qty per person)

  // keep shares arrays sized with people length
  useEffect(() => {
    setShares((old) => {
      const next = { ...old };
      Object.keys(next).forEach((k) => {
        const arr = Array.isArray(next[k]) ? next[k] : [];
        if (arr.length !== people.length) {
          const resized = Array(people.length).fill(0);
          for (let i = 0; i < Math.min(arr.length, resized.length); i++) {
            resized[i] = arr[i];
          }
          next[k] = resized;
        }
      });
      return next;
    });
    // prune single-assign indexes that exceed people length
    setAssign((old) => {
      const n = people.length;
      const next = { ...old };
      Object.keys(next).forEach((k) => {
        if (next[k] == null || next[k] >= n) delete next[k];
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

  // fees delta (tax, service, rounding)
  const feeDelta = useMemo(() => {
    const subtotalN = Number(data.subtotal || 0);
    const totalN = Number(data.total ?? subtotalN);
    const delta = +(totalN - subtotalN).toFixed(3);
    return delta > 0 ? delta : 0;
  }, [data.subtotal, data.total]);

  // EVEN SPLIT — use sane base
  const evenShare = useMemo(() => {
    const totalN = Number(data.total ?? 0);
    const subtotalN = Number(data.subtotal ?? 0);
    const base = Math.max(totalN, subtotalN);
    const n = Math.max(people.length, 1);
    const per = +(base / n).toFixed(3);
    return Array(n).fill(per);
  }, [data.total, data.subtotal, people.length]);

  // ITEMIZED with optional PARTIAL shares
  const itemizedTotals = useMemo(() => {
    const n = people.length;
    const base = Array(n).fill(0);

    data.items.forEach((it, idx) => {
      const unit = Number(it.price) || 0;
      const qty = Number(it.quantity) || 0;
      const sArr = Array.isArray(shares[idx]) ? shares[idx] : null;
      const sumShares = sArr ? sArr.reduce((a, b) => a + (Number(b) || 0), 0) : 0;

      if (sArr && sumShares > 0) {
        // use partial quantities
        for (let p = 0; p < n; p++) {
          const q = Number(sArr[p]) || 0;
          base[p] += unit * q;
        }
      } else {
        // fallback to single-assign if provided
        const owner = assign[idx];
        if (owner != null && owner >= 0 && owner < n) {
          base[owner] += unit * qty;
        }
        // else unassigned -> ignored
      }
    });

    const sumBase = base.reduce((a, b) => a + b, 0);
    const adjusted = base.map((v) => {
      const share =
        sumBase > 0 ? feeDelta * (v / sumBase) : feeDelta / Math.max(n, 1);
      return +(v + share).toFixed(3);
    });

    return adjusted;
  }, [assign, shares, data.items, feeDelta, people.length]);

  // ---- UI actions ----
  const addPerson = () => {
    const name = newPerson.trim();
    setNewPerson("");
    if (!name) return;
    setPeople((p) => [...p, name]);
  };
  const removePerson = (idx) => {
    setPeople((p) => p.filter((_, i) => i !== idx));
  };

  const setShareQty = (itemIdx, personIdx, value, itemQty) => {
    const v = clamp(value, 0, itemQty);
    setShares((prev) => {
      const arr = Array.isArray(prev[itemIdx])
        ? [...prev[itemIdx]]
        : Array(people.length).fill(0);
      arr[personIdx] = v;
      // cap total to itemQty by reducing others proportionally if needed
      const sum = arr.reduce((a, b) => a + (Number(b) || 0), 0);
      if (sum > itemQty + 1e-9) {
        const over = sum - itemQty;
        const othersTotal = sum - v || 1e-9;
        const adjusted = arr.map((q, i) =>
          i === personIdx ? q : Math.max(0, q - (over * (q / othersTotal)))
        );
        return { ...prev, [itemIdx]: adjusted };
      }
      return { ...prev, [itemIdx]: arr };
    });
  };

  const evenSplitItem = (itemIdx, itemQty) => {
    const n = Math.max(people.length, 1);
    const per = +(itemQty / n);
    setShares((prev) => ({
      ...prev,
      [itemIdx]: Array(n).fill(per),
    }));
    // remove single-owner assignment if existed
    setAssign((a) => {
      const nA = { ...a };
      delete nA[itemIdx];
      return nA;
    });
  };

  const clearItemSplit = (itemIdx) => {
    setShares((prev) => {
      const n = { ...prev };
      delete n[itemIdx];
      return n;
    });
    setAssign((a) => {
      const n = { ...a };
      delete n[itemIdx];
      return n;
    });
  };

  const totalsBlock = (values) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        maxWidth: 520,
        gap: 8,
      }}
    >
      {people.map((p, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "6px 8px",
            borderBottom: "1px dashed #eee",
          }}
        >
          <span>{p}</span>
          <b>{(values[idx] ?? 0).toFixed(3)}</b>
        </div>
      ))}
    </div>
  );

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>Split Receipt</h1>
        <Link to="/" style={{ fontSize: 14 }}>
          ← Back to Upload
        </Link>
      </div>

      {/* Summary */}
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
          Select / partial split
        </button>
      </div>

      {/* People */}
      <div
        style={{
          marginTop: 16,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>People</h3>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {people.map((p, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                border: "1px solid #eee",
                borderRadius: 8,
                padding: "4px 8px",
              }}
            >
              <span>{p}</span>
              {people.length > 1 && (
                <button
                  onClick={() => removePerson(idx)}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    padding: "2px 6px",
                    cursor: "pointer",
                  }}
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
            style={{
              flex: "0 1 260px",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: "8px 10px",
            }}
          />
          <button
            onClick={addPerson}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Modes */}
      {mode === "even" && (
        <div
          style={{
            marginTop: 16,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Even split</h3>
          {totalsBlock(evenShare)}
        </div>
      )}

      {mode === "itemized" && (
        <div
          style={{
            marginTop: 16,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Assign items / Partial split</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                  Item
                </th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                  Qty
                </th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                  Price
                </th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                  Line Total
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                  Assign / Split
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, idx) => {
                const sArr = Array.isArray(shares[idx]) ? shares[idx] : Array(people.length).fill(0);
                const sumShares = sArr.reduce((a, b) => a + (Number(b) || 0), 0);
                const remaining = Math.max(0, Number(it.quantity) - sumShares);
                return (
                  <React.Fragment key={idx}>
                    <tr>
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
                        {/* Single owner fallback */}
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <select
                            value={assign[idx] ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : Number(e.target.value);
                              setAssign((a) => ({ ...a, [idx]: val }));
                              // clear shares if single-owner chosen
                              if (val != null) {
                                setShares((prev) => {
                                  const n = { ...prev };
                                  delete n[idx];
                                  return n;
                                });
                              }
                            }}
                            style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px" }}
                          >
                            <option value="">— Single owner —</option>
                            {people.map((p, pIdx) => (
                              <option key={pIdx} value={pIdx}>{p}</option>
                            ))}
                          </select>

                          <button
                            onClick={() => evenSplitItem(idx, Number(it.quantity))}
                            style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer" }}
                            title="Split this item evenly across people"
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

                        {/* Partial quantities matrix */}
                        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                          {people.map((p, pIdx) => (
                            <div key={pIdx} style={{ display: "flex", flexDirection: "column" }}>
                              <label style={{ fontSize: 12, color: "#555" }}>{p}</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={String(sArr[pIdx] ?? 0)}
                                onChange={(e) =>
                                  setShareQty(idx, pIdx, e.target.value, Number(it.quantity))
                                }
                                onFocus={() => {
                                  // switching to partial split clears single-owner for this item
                                  setAssign((a) => {
                                    const n = { ...a };
                                    delete n[idx];
                                    return n;
                                  });
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
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <h4 style={{ marginTop: 0 }}>Totals (incl. tax/fees)</h4>
            {totalsBlock(itemizedTotals)}
          </div>
        </div>
      )}
    </div>
  );
}
