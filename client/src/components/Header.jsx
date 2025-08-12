import React from "react";
import { Link } from "react-router-dom";

const LOGO_URL = import.meta.env.VITE_LOGO_URL || null;

export default function Header() {
  return (
    <header style={{ position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #eee", zIndex: 20 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {LOGO_URL ? (
            <img src={LOGO_URL} alt="GASSEMHA logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#111", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>
              G
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, letterSpacing: 0.2 }}>
              GASSEMHA <span style={{ color: "#999", fontWeight: 500 }}>| قسمها</span>
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>AI Receipt Splitter</div>
          </div>
        </div>

        <nav style={{ display: "flex", gap: 12, fontSize: 14 }}>
          <Link to="/" style={{ color: "#111" }}>Upload</Link>
          <Link to="/split" style={{ color: "#111" }}>Split</Link>
        </nav>
      </div>
    </header>
  );
}
