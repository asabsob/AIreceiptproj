import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://aireceiptsplit-backend-production.up.railway.app";

// Expect `items` via navigation state or localStorage (MVP uses localStorage fallback)
export default function SplitHost() {
  const [items, setItems] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If you already have parsed items in memory, pass them via route state.
    // Here we fallback to localStorage for simplicity.
    const saved = localStorage.getItem("parsedItems");
    if (saved) setItems(JSON.parse(saved));
  }, []);

  const startSession = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Create session failed");
      setSession(data);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 780, margin: "40px auto", padding: 16 }}>
      <h1>Group Split</h1>

      {!items.length && <p>No parsed items found. Go back and parse a receipt first.</p>}

      {items.length > 0 && !session && (
        <>
          <h3>Review items</h3>
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
            {items.map((it, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed #eee" }}>
                <div>{it.name}</div>
                <div>{Number(it.quantity || 1)} × {Number(it.price).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <button disabled={loading} onClick={startSession} style={{ marginTop: 16 }}>
            {loading ? "Starting..." : "Start Split & Generate QR"}
          </button>
        </>
      )}

      {session && (
        <>
          <h3>Share this QR</h3>
          <p>Anyone can scan to join and select their items.</p>
          <div style={{ background: "#fff", padding: 12, display: "inline-block", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <QRCodeCanvas value={session.joinUrl} size={240} includeMargin />
          </div>
          <p style={{ marginTop: 12 }}>
            Or share link:&nbsp;
            <a href={session.joinUrl} target="_blank" rel="noreferrer">{session.joinUrl}</a>
          </p>
        </>
      )}
    </div>
  );
}
