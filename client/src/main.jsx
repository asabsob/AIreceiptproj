import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import Split from "./Split.jsx";
import Room from "./Room.jsx"; // ← add

createRoot(document.getElementById("root")).render(
  <HashRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/split" element={<Split />} />
      <Route path="/room/:id" element={<Room />} /> {/* ← add */}
    </Routes>
  </HashRouter>
);
