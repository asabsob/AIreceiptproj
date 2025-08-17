// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "./index.css";
import { Landing } from "./pages/Landing.jsx";  // named import (Landing exports named)
import Upload from "./pages/Upload.jsx";        // ✅ default import
import Room from "./pages/Room.jsx";            // default import

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/upload", element: <Upload /> },
  { path: "/room/:id", element: <Room /> },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
