// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import "./index.css";                     // ✅ now inside src
import Landing from "./pages/Landing.jsx";
import Upload from "./pages/Upload.jsx";
import Room from "./pages/Room.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/room/:id" element={<Room />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
