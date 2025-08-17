import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import Upload from "./pages/Upload.jsx";
import Room from "./pages/Room.jsx";
import Landing from "./pages/Landing.jsx"; // ⬅️ NEW

function Header() {
  const isDev = import.meta.env.DEV;
  const BACKEND_URL = isDev
    ? import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"
    : import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app";

  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
          <h1 style={{ margin: 0 }}>AIReceiptPro</h1>
        </Link>
        <div className="muted" style={{ fontSize: 14 }}>
          Backend: <code>{BACKEND_URL}</code>
        </div>
      </div>
      <div className="hr"></div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <>
      <Header />
      <div className="container">{children}</div>
    </>
  );
}

function AppRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Landing />} />      {/* ⬅️ NEW default route */}
        <Route path="/upload" element={<Upload />} />
        <Route path="/room/:id" element={<Room />} />
      </Routes>
    </Shell>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  </React.StrictMode>
);
