import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseReceipt } from "../lib/api";

export default function Landing() {
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const data = await parseReceipt(file);

      // Try a few common id keys that the backend might return
      const roomId =
        data?.id || data?.roomId || data?.sessionId || data?.receiptId;

      if (roomId) {
        navigate(`/room/${roomId}`);
      } else {
        console.warn("Parse succeeded but no room id in response:", data);
        alert("Parsed successfully, but no room id returned. Check backend response shape.");
      }
    } catch (err) {
      console.error(err);
      alert(
        `Upload failed: ${err.message}\n\n` +
        `Tips:\n• Ensure CORS is enabled on the backend\n` +
        `• Endpoint should be POST ${import.meta.env.VITE_BACKEND_URL || ""}/parse\n` +
        `• Field name should be "file" (fallback tries "image")`
      );
    } finally {
      setIsUploading(false);
      // reset input so selecting the same file again retriggers change
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        id="receipt-input"
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={onFileChange}
      />

      {/* HERO ... */}
      <section className="hero" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="container" style={{ padding: "32px 0" }}>
          <div style={{ display: "grid", gap: 24, gridTemplateColumns: "1fr", alignItems: "center" }}>
            <div style={{ maxWidth: 680 }}>
              <span className="pill">New • AI-powered splitting</span>
              <h2 style={{ margin: "8px 0 0", fontSize: 42, lineHeight: 1.1 }}>
                Split Receipts <span style={{ color: "#2563eb" }}>Smarter</span> with AI
              </h2>
              <p className="muted" style={{ marginTop: 10 }}>
                Upload any receipt. We’ll parse items, assign to people, and generate payment links—fast.
              </p>

              {/* Use label -> input to open the picker reliably */}
              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <label
                  htmlFor="receipt-input"
                  className="btn primary"
                  role="button"
                  style={{ pointerEvents: isUploading ? "none" : "auto", opacity: isUploading ? 0.7 : 1 }}
                >
                  {isUploading ? "Uploading…" : "Upload Receipt"}
                </label>
              </div>

              <ul className="muted" style={{ marginTop: 16, paddingLeft: 18 }}>
                <li>Works with photos or PDFs</li>
                <li>No POS integration required</li>
                <li>Shareable QR payment links</li>
              </ul>
            </div>

            {/* Visual card */}
            {/* ...the rest of your card/sections stay the same... */}
          </div>
        </div>
      </section>

      {/* Trust bar + Steps unchanged */}
    </>
  );
}
