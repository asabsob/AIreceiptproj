// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";

import "./index.css";
import { Landing } from "./pages/Landing.jsx";
 import { Upload } from "./pages/Upload.jsx";
import Room from "./pages/Room.jsx";

const router = createHashRouter([
  { path: "/", element: <Landing /> },
  { path: "/upload", element: <Upload /> },
  { path: "/room/:id", element: <Room /> },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
