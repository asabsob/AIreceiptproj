import React, { useState } from "react";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";

const isDev = import.meta.env.DEV;
const BACKEND_URL = isDev
  ? (import.meta.env.VITE_BACKEND_URL || "http://localhost:5000")
  : (import.meta.env.VITE_BACKEND_URL || "");

if (!isDev && !BACKEND_URL) {
  console.error("VITE_BACKEND_URL is missing in production build.");
}
const PUBLIC_ORIGIN = import.meta.env.VITE_PUBLIC_ORIGIN || window.location.origin;

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError("");
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("Please choose an image.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);

      const { data } = await axios.post(`${BACKEND_URL}/parse`, form, {
        timeout: 60000,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Upload failed. Check backend URL and CORS."
      );
    } finally {
      setLoading(false);
    }
  };

  const totalCalc =
    result?.items?.reduce(
      (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    ) ?? 0;

  // Share URL with encoded result in the hash
const shareUrl = result
  ? `${PUBLIC_ORIGIN}/split#data=${encodeURIComponent(btoa(JSON.stringify(result)))}`
  : "";

  return (
    <div
      style={{
        maxWidth: 920,
        margin: "40px auto",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>AIReceiptPro</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Upload a receipt image → parse with AI → see structured items.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Left panel: upload */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <label
            htmlFor="file"
            style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
          >
            Receipt image
          </label>
          <input id="file" type="file" accept="image/*" onChange={onFile} />
          {preview && (
            <div style={{ marginTop: 12 }}>
              <img
                src={preview}
                alt="preview"
                style={{
                  maxWidth: "100%",
                  borderRadius: 12,
                  border: "1px solid #eee",
                }}
              />
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading || !file}
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Parsing..." : "Parse receipt"}
          </button>
          {error && (
            <div style={{ marginTop: 12, color: "#b00020", fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>

        {/* Right panel: results */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, minHeight: 200 }}>
          <h3 style={{ marginTop: 0 }}>Parsed result</h3>
          {!result && <div style={{ color: "#777" }}>No data yet.</div>}

          {result && (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Item
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Qty
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Price
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        borderBottom: "1px solid #ddd",
                        padding: 8,
                      }}
                    >
                      Line Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f1f1f1",
                        }}
                      >
                        {it.name}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f1f1f1",
                          textAlign: "right",
                        }}
                      >
                        {it.quantity}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f1f1f1",
                          textAlign: "right",
                        }}
                      >
                        {Number(it.price || 0).toFixed(3)}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          borderBottom: "1px solid #f1f1f1",
                          textAlign: "right",
                        }}
                      >
                        {(Number(it.price || 0) * Number(it.quantity || 1)).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td />
                    <td />
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>
                      Subtotal
                    </td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>
                      {Number(result.subtotal ?? totalCalc).toFixed(3)}
                    </td>
                  </tr>
                  <tr>
                    <td />
                    <td />
                    <td style={{ padding: 8, textAlign: "right" }}>Tax</td>
                    <td style={{ padding: 8, textAlign: "right" }}>
                      {result.tax != null ? Number(result.tax).toFixed(3) : "-"}
                    </td>
                  </tr>
                  <tr>
                    <td />
                    <td />
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>
                      Total
                    </td>
                    <td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>
                      {Number(result.total ?? totalCalc).toFixed(3)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <details style={{ marginTop: 12 }}>
                <summary>Raw JSON</summary>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    background: "#fafafa",
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
{JSON.stringify(result, null, 2)}
                </pre>
              </details>

              {/* QR SHARE */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eee" }}>
                <h4 style={{ margin: 0, marginBottom: 8 }}>Share via QR</h4>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <QRCodeCanvas value={shareUrl} size={160} includeMargin />
                  <div style={{ maxWidth: 520, wordBreak: "break-all", fontSize: 13 }}>
                    <div style={{ marginBottom: 6, color: "#555" }}>
                      Scan to open this receipt on another device:
                    </div>
                    <code>{shareUrl}</code>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 13, color: "#777" }}>
        Backend URL: <code>{BACKEND_URL}</code> (override with <code>VITE_BACKEND_URL</code>)
      </div>
    </div>
  );
}
