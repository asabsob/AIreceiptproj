import React from "react";
import React, { useRef } from "react";
export default function FlowMock() {
  const steps = [
    { t: "Upload receipt", d: "Drag & drop a photo or PDF." },
    { t: "AI parsing & split", d: "Items recognized, assign to diners." },
    { t: "Share payment links", d: "Generate QR or deep links to pay." },
  ];
  return (
    <section id="how" className="flow">
      <div className="container">
        <h2>From photo to payment in three steps</h2>
        <div className="cards3">
          {steps.map((s, i)=>(
            <div className="step-card" key={s.t}>
              <div className="step-tag">STEP {i+1}</div>
              <div className="step-title">{s.t}</div>
              <p className="muted">{s.d}</p>
              <div className="skeleton w80" />
              <div className="skeleton w60" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
