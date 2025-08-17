import React from "react";
import React, { useRef } from "react";
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 16px",
      borderBottom: "1px solid #eee",
      fontFamily: "system-ui, sans-serif"
    }}>
      <Link to="/" style={{ textDecoration: "none", color: "#111" }}>
        <b>AIReceiptPro</b>
      </Link>
      <div style={{ fontSize: 12, color: "#666" }}>
        <a href="https://aireceiptsplit-backend-production.up.railway.app/health" target="_blank" rel="noreferrer">
          Backend Health
        </a>
      </div>
    </div>
  );
}
