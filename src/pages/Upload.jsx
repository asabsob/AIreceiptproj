import { useNavigate } from "react-router-dom";
import { extractRoomId, isValidId } from "../lib/extractRoomId";

export default function Upload() {
  const navigate = useNavigate();

  async function handleFile(file) {
    const form = new FormData();
    form.append("file", file); // backend expects "file"

    const base = import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app";
    const res = await fetch(`${base}/parse`, { method: "POST", body: form });

    // Build a response-like object for heuristics
    const headers = Object.fromEntries(res.headers.entries());
    const rawText = await res.clone().text().catch(() => "");
    const data = await res.json().catch(() => ({}));

    // Helpful debug
    console.log("[parse] backend response");
    console.log("headers:", headers);
    console.log("data:", data);
    if (rawText) console.log("rawText:", rawText.slice(0, 400));

    const id = extractRoomId({ data, headers, rawText });

  if (!isValidId(id)) {
  alert(
    "Parsed successfully, but no room id returned. Please check the backend response shape."
  );
  return;
}

// extra safety: make sure this id actually exists server-side
const base = import.meta.env.VITE_BACKEND_URL || "https://aireceiptsplit-backend-production.up.railway.app";
const check = await fetch(`${base}/session/${encodeURIComponent(id)}`);
if (!check.ok) {
  console.warn("ID verification failed:", id, check.status);
  alert(
    `Backend returned id "${id}", but GET /session/${id} responded ${check.status}.` +
    `\nThis likely isn't the session id. Please adjust the backend to return the real session id.`
  );
  return;
}

navigate(`/room/${encodeURIComponent(id)}`);

