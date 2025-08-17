// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "./index.css";
import { Landing } from "./pages/Landing.jsx";   // named export
import { Upload } from "./pages/Upload.jsx";     // <-- fix: named export
import Room from "./pages/Room.jsx";             // default export

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
