import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../App.jsx";
import QRCode from "qrcode.react";

export default function SplitHost() {
  const { state } = useLocation();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  const items = useMemo(() => {
    // Items passed from App via navigate("/split", { state: { items } })
    if (Array.isArray(state?.items) && state.items.length) return state.items;
    return [];
  }, [state]);

  useEffect(() => {
    const create = async () => {
      try {
        if (!items.length) {
          setError("No items provided. Go back and parse a receipt first.");
          return;
        }
        const resp = await axios.post(`${API_BASE}/session`, { items });
        setSession(resp.data); // { sessionId, joinUrl }
      } catch (e) {
        const payload = e?.response?.data || e.message;
        setError(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
      }
    };
    create();
  }, [items]);

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Couldn’t create session</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    );
  }

  if (!session) {
    return <div style={{ padding: 20 }}>Creating session…</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Share this QR</h1>
      <p>Ask everyone to scan and pick their items.</p>

      <div style={{ background: "#fff", padding: 16, display: "inline-block" }}>
        <QRCode value={session.joinUrl} size={220} />
      </div>

      <div style={{ marginTop: 12 }}>
        <a href={session.joinUrl} target="_blank" rel="noreferrer">
          {session.joinUrl}
        </a>
      </div>
    </div>
  );
}
