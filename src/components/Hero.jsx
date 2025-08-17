export default function Hero({ onUpload, onDemo }) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="pill">New • AI-powered splitting</span>
          <h1>Split Receipts <span className="brand-accent">Smarter</span> with AI</h1>
          <p>Upload any receipt. We’ll parse items, assign to people, and generate payment links—fast.</p>
          <div className="cta-row">
            <button className="btn primary" onClick={onUpload}>Upload Receipt</button>
            <button className="btn" onClick={onDemo}>Try Demo</button>
          </div>
          <ul className="bullets">
            <li>Works with photos or PDFs</li>
            <li>No POS integration required</li>
            <li>Shareable QR payment links</li>
          </ul>
        </div>

        <div className="hero-visual">
          <div className="card">
            <div className="mini-title">RECEIPT</div>
            <div className="skeleton w85" />
            <div className="skeleton w70" />
            <div className="skeleton w78" />
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
                {["Sameer","Omar","Ahmad","Faisal"].map(n=>(
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
              <button className="link" onClick={onUpload}>Upload now →</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
