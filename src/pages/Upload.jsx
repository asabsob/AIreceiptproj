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
        "Parsed successfully, but no room id returned. Please check the backend response shape.\n\n" +
        "Tip: return one of { id | roomId | session | sessionId | receiptId } as a string/number, or set a Location: /session/<id> or /room/<id> header."
      );
      return;
    }

    navigate(`/room/${encodeURIComponent(id)}`);
  }

  // ...your component’s JSX that calls handleFile(file)
}
