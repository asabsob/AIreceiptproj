import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "https://aireceiptsplit-backend-production.up.railway.app";

export default function JoinPage() {
  const { sessionId } = useParams();
  const [user, setUser] = useState(localStorage.getItem("splitUser") || "");
  const [data, setData] = useState(null);
  const [claims, setClaims] = useState({}); // { itemId: qty }
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const fetchSession = async () => {
    const resp = await fetch(`${API_BASE}/session/${sessionId}`);
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "Failed to fetch session");
    setData(json);
  };

  useEffect(() => {
    fetchSession().catch((e) => alert(e.message));
    // Light polling to reflect others' claims (5s). Remove if using websockets later.
    const t = setInterval(fetchSession, 5000);
    return () => clearInterval(t);
  }, [sessionId]);

  const totalPreview = useMemo(() => {
    if (!data?.items) return 0;
    return data.items.reduce((sum, it) => {
      const qty = Number(claims[it.id] || 0);
      return sum + qty * Number(it.price || 0);
    }, 0).toFixed(2);
  }, [data, claims]);

  const changeQty = (itemId, next) => {
    setClaims((prev) => ({ ...prev, [itemId]: Math.max(0, next) }));
  };

  const submitClaims = async () => {
    try {
      if (!user.trim()) return alert("Please enter your name");
      setLoading(true);
      localStorage.setItem("splitUser", user.trim());

      const payload = {
        user: user.trim(),
        claims: Object.entries(claims)
          .filter(([_, qty]) => Number(qty) > 0)
          .map(([itemId, qty]) => ({ itemId, qty: Number(qty) }))
      };

      if (!payload.claims.length) return alert("Select at least one item");

      const resp = await fetch(`${API_BASE}/session/${sessionId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Claim failed");
      setResult(json);
      await fetchSession(); // refresh remaining counts
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!data) return <div style={{ padding: 16 }}>Loading session…</div>;

  return (
    <div style={{ maxWidth: 780, margin: "40px auto", padding: 16 }}>
      <h1>Join Split</h1>
      <div style={{ margin: "12px 0" }}>
        <label>Your name:&nbsp;</label>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="e.g., Sameer"
        />
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        {data.items.map((it) => (
          <div key={it.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 140px 180px", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px dashed #eee" }}>
            <div>{it.name}</div>
            <div style={{ textAlign: "right" }}>{Number(it.price).toFixed(2)}</div>
            <div style={{ textAlign: "center" }}>Remaining: {it.remaining}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => changeQty(it.id, Number(claims[it.id] || 0) - 1)} disabled={(claims[it.id] || 0) <= 0}>-</button>
              <input
                type="number"
                min="0"
                max={it.remaining}
                value={claims[it.id] || 0}
                onChange={(e) => changeQty(it.id, Math.min(Number(e.target.value || 0), it.remaining))}
                style={{ width: 60, textAlign: "center" }}
              />
              <button onClick={() => changeQty(it.id, Math.min(Number(claims[it.id] || 0) + 1, it.remaining))} disabled={(claims[it.id] || 0) >= it.remaining}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>My total preview: {totalPreview}</strong>
      </div>

      <button onClick={submitClaims} disabled={loading} style={{ marginTop: 12 }}>
        {loading ? "Submitting…" : "Confirm Selection"}
      </button>

      {result && (
        <div style={{ marginTop: 16, padding: 12, background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 8 }}>
          <div><strong>Saved!</strong> {result.user}, your total is <strong>{result.total.toFixed(2)}</strong></div>
        </div>
      )}
    </div>
  );
}
