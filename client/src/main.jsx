import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter as Router, Routes, Route } from "react-router-dom";

import App from "./App.jsx";
import SplitHost from "./pages/SplitHost.jsx";
import JoinPage from "./pages/JoinPage.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/split" element={<SplitHost />} />
        <Route path="/join/:sessionId" element={<JoinPage />} />
      </Routes>
    </Router>
  </React.StrictMode>
);
