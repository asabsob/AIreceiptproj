import React, { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Landing() {
  const fileRef = useRef(null);
  const navigate = useNavigate();

  const onUploadClick = () => fileRef.current?.click();
  const onDemoClick = () => navigate("/upload?demo=1");

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
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
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

              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <button className="btn primary" onClick={onUploadClick}>Upload Receipt</button>
                <button className="btn" onClick={onDemoClick}>Try Demo</button>
                <Link to="/upload" className="btn" style={{ textDecoration: "none" }}>Open Uploader</Link>
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
                  <button className="link" onClick={onUploadClick}>Upload now →</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <div className="trust">
        <div className="container trust-row">
          <span className="muted">Works with</span>
          <div className="logo" /><div className="logo" /><div className="logo" /><div className="logo" />
        </div>
      </div>

      {/* Steps */}
      <section className="flow">
        <div className="container">
          <h3 style={{ fontSize: 28, margin: "26px 0 6px" }}>
            From photo to payment in three steps
          </h3>
          <div className="cards3">
            {[
              { t: "Upload receipt", d: "Drag & drop a photo or PDF." },
              { t: "AI parsing & split", d: "Items recognized, assign to diners." },
              { t: "Share payment links", d: "Generate QR or deep links to pay." },
            ].map((s, i) => (
              <div key={s.t} className="step-card">
                <div className="step-tag">STEP {i + 1}</div>
                <div className="step-title">{s.t}</div>
                <p className="muted">{s.d}</p>
                <div className="skeleton w80" />
                <div className="skeleton w60" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
