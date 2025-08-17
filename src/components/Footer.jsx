import React from "react";
import React, { useRef } from "react";
export default function Footer() {
  return (
    <footer className="footer">
      <div className="container foot-row">
        <div className="brand">
          <div className="brand-dot" />
          <span>AIReceipt <b className="brand-accent">Pro</b></span>
        </div>
        <div className="foot-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
          <a href="#contact">Contact</a>
        </div>
      </div>
      <div className="container foot-copy muted">
        © {new Date().getFullYear()} AIReceipt Pro. All rights reserved.
      </div>
    </footer>
  );
}
