export default function Navbar() {
  return (
    <header className="nav">
      <div className="container nav-row">
        <div className="brand">
          <div className="brand-dot" />
          <span>AIReceipt <b className="brand-accent">Pro</b></span>
        </div>
        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="nav-ctas">
          <button className="btn ghost">Sign in</button>
          <button className="btn primary">Get started</button>
        </div>
      </div>
    </header>
  );
}
