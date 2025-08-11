import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../App.jsx";

export default function JoinPage() {
  const { sessionId } = useParams();
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [qtyById, setQtyById] = useState({});
  const [message, setMessage] = useState("");

  const load = async () => {
    setMessage("");
    try {
      const resp = await axios.get(`${API_BASE}/session/${sessionId}`);
      setItems(resp.data.items || []);
    } catch (e) {
      const payload = e?.response?.data || e.message;
      setMessage(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const submit = async () => {
    try {
      if (!name.trim()) {
        alert("Please enter your name");
        return;
      }
      const claims = Object.entries(qtyById)
        .map(([itemId, qty]) => ({ itemId, qty: Number(qty || 0) }))
        .filter((c) => c.qty > 0);

      if (!claims.length) {
        alert("Set at least one quantity > 0");
        return;
      }
      const resp = await axios.post(`${API_BASE}/session/${sessionId}/claim`, {
        user: name.trim(),
        claims,
      });
      setMessage(`Saved! Your total: $${resp.data.total.toFixed(2)}`);
      await load();
    } catch (e) {
      const payload = e?.response?.data || e.message;
      setMessage(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Join Split</h1>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 8, fontSize: 16 }}
        />
      </div>

      {!items.length && <div>No items yet.</div>}

      {items.map((it) => (
        <div key={it.id} style={{ marginBottom: 10, borderBottom: "1px solid #eee", paddingBottom: 8 }}>
          <div>
            <strong>{it.name}</strong> — ${Number(it.price).toFixed(2)} × {it.qty}{" "}
            <em>(remaining: {it.remaining})</em>
          </div>
          <input
            type="number"
            min="0"
            max={it.remaining}
            value={qtyById[it.id] ?? ""}
            onChange={(e) => setQtyById({ ...qtyById, [it.id]: e.target.value })}
            style={{ width: 80, padding: 6, marginTop: 6 }}
            placeholder="qty"
          />
        </div>
      ))}

      <button onClick={submit} style={{ padding: "8px 14px", fontSize: 16 }}>Claim</button>

      {message && (
        <div style={{ marginTop: 10 }}>
          <em>{message}</em>
        </div>
      )}
    </div>
  );
}
