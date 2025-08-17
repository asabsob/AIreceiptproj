import React, { useRef } from "react";
// import { useNavigate } from "react-router-dom"; // not needed if no demo

export default function Landing() {
  const fileRef = useRef(null);
  // const navigate = useNavigate(); // not needed if no demo

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // TODO: connect to your backend
    // const form = new FormData();
    // form.append("file", file);
    // const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/parse`, { method: "POST", body: form });
    // const data = await res.json();
    // navigate(`/room/${data.id}`);
  };

  return (
    <>
      <input
        id="receipt-input"               // ✅ give it an id
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"               // can stay hidden now
        onChange={onFileChange}
      />

      {/* HERO */}
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

              {/* ✅ label opens the file picker reliably */}
              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <label htmlFor="receipt-input" className="btn primary" role="button">
                  Upload Receipt
                </label>
              </div>

              <ul className="muted" style={{ marginTop: 16, paddingLeft: 18 }}>
                <li>Works with photos or PDFs</li>
                <li>No POS integration required</li>
                <li>Shareable QR payment links</li>
              </ul>
            </div>

            {/* Visual card */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: "100%", maxWidth: 420, background: "#fff",
                  border: "1px solid #e5e7eb", borderRadius: 14,
                  boxShadow: "0 8px 24px rgba(16,24,40,.06)", padding: 14
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", color: "#6b7280" }}>
                  RECEIPT
                </div>
                <div className="skeleton w85" />
                <div className="skeleton w70" />
                <div className="skeleton w80" />
                <div className="skeleton w60" />

                <div className="grid-3">
                  <div className="panel">
                    <div className="panel-title">Parsed Items</div>
                    <div className="skeleton w90" />
                    <div className="skeleton w70" />
                    <div className="skeleton w80" />
                  </div>
                  <div className="panel">
                    <div className="panel-title">Assign to Diners</div>
                    {["Sameer", "Omar", "Ahmad", "Faisal"].map((n) => (
                      <span key={n} className="chip">{n}</span>
                    ))}
                  </div>
                  <div className="panel">
                    <div className="panel-title">Pay</div>
                    <div className="qr" aria-label="QR mock" />
                  </div>
                </div>

                <div className="card-foot">
                  <span className="muted">Secure processing</span>
                  {/* ✅ same trick for the footer link */}
                  <label htmlFor="receipt-input" className="link" role="button">
                    Upload now →
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar + Steps ... unchanged */}
    </>
  );
}
