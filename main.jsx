import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import Upload from "./pages/Upload.jsx";
import Room from "./pages/Room.jsx";
import Header from "./components/Header.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Upload />} />
        <Route path="/room/:id" element={<Room />} />
        <Route
          path="*"
          element={
            <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
              Not found. <Link to="/">Home</Link>
            </div>
          }
        />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
