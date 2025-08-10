import React, { useState } from "react";
import axios from "axios";

// Detect environment and set API base
const isLocal =
  window.location.hostname.includes("localhost") ||
  window.location.hostname.includes("127.0.0.1");

const API_BASE = isLocal
  ? "http://localhost:5000"
  : (import.meta.env.VITE_API_BASE || "https://aireceiptsplit-backend-production.up.railway.app");
console.log("API_BASE =", API_BASE);

function App() {
  const [file, setFile] = useState(null);
  const [items, setItems] = useState([]);
  const [splitMode, setSplitMode] = useState("evenly");
  const [numPeople, setNumPeople] = useState(2);
  const [assignments, setAssignments] = useState({});
  const [paymentMethod, setPaymentMethod] = useState({});

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



  return (
    <div style={{ padding: 20 }}>
      <h1>🧾 AI Receipt Splitter</h1>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Upload & Parse</button>
      <pre>{JSON.stringify(items, null, 2)}</pre>

      <h2>💳 Split Options</h2>
      <label>
        Number of People:
        <input
          type="number"
          min="1"
          value={numPeople}
          onChange={(e) => setNumPeople(parseInt(e.target.value))}
        />
      </label>

      <label>
        Split Mode:
        <select
          value={splitMode}
          onChange={(e) => setSplitMode(e.target.value)}
        >
          <option value="evenly">Evenly</option>
          <option value="byItem">By Item</option>
        </select>
      </label>

      {splitMode === "byItem" && (
        <div>
          <h3>🧍 Assign Items</h3>
          {Array.from({ length: numPeople }).map((_, personIndex) => (
            <div key={personIndex}>
              <h4>Person {personIndex + 1}</h4>
              {items.map((item, itemIndex) => (
                <label key={itemIndex} style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={
                      assignments[personIndex]?.includes(itemIndex) || false
                    }
                    onChange={() => {
                      const current = assignments[personIndex] || [];
                      const updated = current.includes(itemIndex)
                        ? current.filter((i) => i !== itemIndex)
                        : [...current, itemIndex];
                      setAssignments({
                        ...assignments,
                        [personIndex]: updated,
                      });
                    }}
                  />
                  {item.name} - {item.price.toFixed(2)}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      <h3>💰 Payment Summary</h3>
      {Array.from({ length: numPeople }).map((_, personIndex) => {
        let total = 0;
        if (splitMode === "evenly") {
          total =
            items.reduce((sum, item) => sum + item.price, 0) / numPeople;
        } else {
          const assigned = assignments[personIndex] || [];
          total = assigned.reduce((sum, idx) => sum + items[idx].price, 0);
        }

        return (
          <div key={personIndex} style={{ marginBottom: 10 }}>
            <strong>Person {personIndex + 1}:</strong> ${total.toFixed(2)}
            <br />
            Payment:
            <select
              value={paymentMethod[personIndex] || "cash"}
              onChange={(e) =>
                setPaymentMethod({
                  ...paymentMethod,
                  [personIndex]: e.target.value,
                })
              }
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online">Online (QR)</option>
            </select>
          </div>
        );
      })}
    </div>
  );
}

export default App;
