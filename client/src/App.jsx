import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom"; // <-- add

// Detect environment and set API base
const isLocal =
  location.hostname.includes("localhost") || location.hostname.includes("127.0.0.1");

export const API_BASE = isLocal
  ? "http://localhost:5000"
  : (import.meta.env.VITE_API_BASE || "https://aireceiptsplit-backend-production.up.railway.app");

function App() {
  const [file, setFile] = useState(null);
  const [items, setItems] = useState([]);
  const [splitMode, setSplitMode] = useState("evenly");
  const [numPeople, setNumPeople] = useState(2);
  const [assignments, setAssignments] = useState({});
  const [paymentMethod, setPaymentMethod] = useState({});
  const navigate = useNavigate(); // <-- add

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result.split(",")[1];
      const mime = file?.type || "image/jpeg";

      try {
        const response = await axios.post(`${API_BASE}/parse`, {
          image: base64Image,
          mime,
        });
        setItems(response.data.items || []);
      } catch (error) {
        const payload = error?.response?.data || error.message;
        console.error("Upload failed:", payload);
        alert(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
      }
    };
    reader.readAsDataURL(file);
  };

  const goToSplit = () => {
    if (!items.length) {
      alert("Parse a receipt first.");
      return;
    }
    // pass items to SplitHost
    navigate("/split", { state: { items } });
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>🧾 AI Receipt Splitter</h1>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Upload & Parse</button>

      {items.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button onClick={goToSplit}>Create Group QR</button>
        </div>
      )}

      <pre>{JSON.stringify(items, null, 2)}</pre>

      {/* … your existing split options UI … */}
    </div>
  );
}

export default App;
