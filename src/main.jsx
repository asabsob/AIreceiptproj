import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";

import Upload from "./pages/Upload.jsx";
import Room from "./pages/Room.jsx";
// If you added this, ensure the file exists; otherwise remove the line.
// import "./index.css";

createRoot(document.getElementById("root")).render(
  <HashRouter>
    <Routes>
      <Route path="/" element={<Upload />} />
      <Route path="/room/:id" element={<Room />} />
    </Routes>
  </HashRouter>
);
